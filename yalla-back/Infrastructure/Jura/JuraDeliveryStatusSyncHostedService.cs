using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Jura;

/// <summary>
/// Polls JURA every 30s for active deliveries and mirrors status into our DB.
/// Only 3 JURA status_ids surface to the client as SMS/UI updates: 4, 7, 9.
/// Other statuses (1 Поступило, 2 Водитель назначен, 10 Отменен, 19/20/21 служебные)
/// are persisted as-is but do not trigger notifications.
/// </summary>
public sealed class JuraDeliveryStatusSyncHostedService : BackgroundService
{
  private static readonly HashSet<int> NotifiableStatusIds = new() { 4, 7, 9, 10 };
  private static readonly int[] TerminalStatusIds = new[] { 9, 10 };

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly ILogger<JuraDeliveryStatusSyncHostedService> _logger;
  private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);

  public JuraDeliveryStatusSyncHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<JuraDeliveryStatusSyncHostedService> logger)
  {
    ArgumentNullException.ThrowIfNull(scopeFactory);
    ArgumentNullException.ThrowIfNull(logger);

    _scopeFactory = scopeFactory;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    _logger.LogInformation("JURA delivery status sync started. Interval={Seconds}s.", _interval.TotalSeconds);
    using var timer = new PeriodicTimer(_interval);

    await RunOnceAsync(stoppingToken);
    while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
    {
      await RunOnceAsync(stoppingToken);
    }
  }

  public async Task RunOnceAsync(CancellationToken cancellationToken)
  {
    try
    {
      using var scope = _scopeFactory.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var juraService = scope.ServiceProvider.GetService<IJuraService>();
      if (juraService is null)
        return;

      var health = scope.ServiceProvider.GetRequiredService<IJuraHealthState>();
      if (health.IsCircuitOpen(DateTime.UtcNow))
      {
        _logger.LogDebug("JURA circuit is open — skipping this poll tick.");
        return;
      }

      var deliveries = await dbContext.DeliveryData
        .AsTracking()
        .Where(d =>
          d.JuraOrderId != null
          && (d.JuraStatusId == null || !TerminalStatusIds.Contains(d.JuraStatusId.Value)))
        .Join(
          dbContext.Orders.AsTracking().Where(o =>
            o.Status != Status.Cancelled
            && o.Status != Status.Delivered
            && o.Status != Status.PickedUp
            && o.Status != Status.Returned),
          d => d.OrderId,
          o => o.Id,
          (d, o) => new { Delivery = d, Order = o })
        .Take(50)
        .ToListAsync(cancellationToken);

      if (deliveries.Count == 0)
        return;

      var smsTemplates = scope.ServiceProvider.GetRequiredService<IOptions<SmsTemplatesOptions>>().Value;
      var telegramBot = scope.ServiceProvider.GetService<ITelegramBotApi>();
      var realtime = scope.ServiceProvider.GetRequiredService<IRealtimeUpdatesPublisher>();
      var orderService = scope.ServiceProvider.GetRequiredService<IOrderService>();

      foreach (var item in deliveries)
      {
        cancellationToken.ThrowIfCancellationRequested();
        await SyncSingleAsync(item.Delivery, item.Order, juraService, telegramBot, dbContext, realtime, orderService, smsTemplates, cancellationToken);
      }

      await dbContext.SaveChangesAsync(cancellationToken);
      health.RecordPollSuccess(deliveries.Count, DateTime.UtcNow);
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception ex)
    {
      _logger.LogError(ex, "JURA delivery status sync iteration failed.");
      try
      {
        using var scope = _scopeFactory.CreateScope();
        scope.ServiceProvider.GetRequiredService<IJuraHealthState>()
          .RecordPollFailure(ex.GetType().Name + ": " + ex.Message, DateTime.UtcNow);
      }
      catch { /* best-effort */ }
    }
  }

  private async Task SyncSingleAsync(
    Domain.Entities.DeliveryData delivery,
    Domain.Entities.Order order,
    IJuraService juraService,
    ITelegramBotApi? telegramBot,
    AppDbContext dbContext,
    IRealtimeUpdatesPublisher realtime,
    Yalla.Application.Services.IOrderService orderService,
    SmsTemplatesOptions smsTemplates,
    CancellationToken ct)
  {
    if (!delivery.JuraOrderId.HasValue)
      return;

    try
    {
      var status = await juraService.GetOrderStatusAsync(delivery.JuraOrderId.Value, ct);

      var previousStatusId = delivery.JuraStatusId;
      delivery.UpdateJuraStatus(status.Status, status.StatusId);

      // JURA cancelled the delivery on their side → cancel our order too
      // (restore stock, refund Cost + DeliveryCost, notify).
      if (status.StatusId == 10 && previousStatusId != 10
        && order.Status is not (Status.Cancelled or Status.Delivered or Status.PickedUp or Status.Returned))
      {
        // Save the JuraStatusId update BEFORE the cascading cancel, so we don't
        // loop here if the cancel itself fails for some reason.
        await dbContext.SaveChangesAsync(ct);
        try
        {
          await orderService.CancelOrderFromJuraAsync(order.Id, "JURA delivery cancelled", ct);
          await NotifyClientAsync(order, delivery, 10, telegramBot, dbContext, smsTemplates, ct);
        }
        catch (Exception ex)
        {
          _logger.LogError(ex,
            "Failed to auto-cancel order {OrderId} after JURA status=10",
            order.Id);
        }
        return;
      }

      if (status.TraccarDeviceId.HasValue)
      {
        var driverName = $"{status.FirstName} {status.LastName}".Trim();
        delivery.SetDriverInfo(status.TraccarDeviceId, driverName, status.Phone);
      }

      // Fetch receipt code lazily once driver is engaged (status >= 4) and we don't have it yet.
      if (string.IsNullOrEmpty(delivery.RecipientCode) && status.StatusId >= 4)
      {
        try
        {
          var code = await juraService.GetReceiptCodeAsync(delivery.JuraOrderId.Value, ct);
          if (!string.IsNullOrWhiteSpace(code))
            delivery.SetRecipientCode(code);
        }
        catch (Exception ex)
        {
          _logger.LogDebug(ex,
            "Could not fetch receipt code for JURA order {JuraOrderId} (will retry next tick).",
            delivery.JuraOrderId);
        }
      }

      // Auto-transition local Order.Status based on JURA status_id.
      var oldOrderStatus = order.Status;
      TryAutoTransitionOrderStatus(order, status.StatusId);
      if (order.Status != oldOrderStatus)
      {
        _logger.LogInformation(
          "Order {OrderId} auto-transitioned {OldStatus} → {NewStatus} via JURA status_id={JuraStatusId}",
          order.Id, oldOrderStatus, order.Status, status.StatusId);
        await realtime.PublishOrderStatusChangedAsync(
          order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, ct);
      }

      // Notify client on transitions into tracked statuses (4/7/9) only.
      if (status.StatusId != previousStatusId && NotifiableStatusIds.Contains(status.StatusId))
      {
        await NotifyClientAsync(order, delivery, status.StatusId, telegramBot, dbContext, smsTemplates, ct);
      }
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex,
        "Failed to sync JURA status for order {OrderId}, jura {JuraOrderId}",
        order.Id, delivery.JuraOrderId);
    }
  }

  private static void TryAutoTransitionOrderStatus(Domain.Entities.Order order, int juraStatusId)
  {
    if (order.IsPickup) return;

    try
    {
      switch (juraStatusId)
      {
        case 7 when order.Status == Status.Ready:
          order.MarkOnTheWayFromDelivery();
          break;
        case 4 when order.Status == Status.OnTheWay:
          order.MarkDriverArrivedFromDelivery();
          break;
        case 9 when order.Status is Status.OnTheWay or Status.DriverArrived:
          order.MarkDeliveredFromDelivery();
          break;
        // Other JURA transitions (including pre-transit status 4 while still Ready) are ignored.
      }
    }
    catch (Yalla.Domain.Exceptions.DomainException)
    {
      // Domain rejected the transition (e.g., state changed concurrently) — let next tick re-evaluate.
    }
  }

  private async Task NotifyClientAsync(
    Domain.Entities.Order order,
    Domain.Entities.DeliveryData delivery,
    int juraStatusId,
    ITelegramBotApi? telegramBot,
    AppDbContext dbContext,
    SmsTemplatesOptions smsTemplates,
    CancellationToken ct)
  {
    if (!smsTemplates.JuraDelivery.TryGetValue(juraStatusId.ToString(), out var template)
      || string.IsNullOrWhiteSpace(template))
    {
      return;
    }

    var message = template
      .Replace("{orderId}", order.Id.ToString("D"), StringComparison.OrdinalIgnoreCase)
      .Replace("{receiptCode}", delivery.RecipientCode ?? "—", StringComparison.OrdinalIgnoreCase);

    var phone = order.ClientPhoneNumber;
    // ClientService sets empty phone for Telegram-only clients (see ResolveRecipientPhone).
    var hasRealPhone = !string.IsNullOrWhiteSpace(phone);

    if (hasRealPhone)
    {
      try
      {
        var outboxMessage = SmsOutboxMessage.CreatePending(
          orderId: order.Id,
          phoneNumber: phone,
          statusSnapshot: Status.OnTheWay, // nominal; real dedup is via MessageKey
          message: message,
          provider: string.IsNullOrWhiteSpace(smsTemplates.Provider) ? "OsonSms" : smsTemplates.Provider,
          nowUtc: DateTime.UtcNow,
          messageKey: $"jura:{juraStatusId}");

        dbContext.SmsOutboxMessages.Add(outboxMessage);
        try
        {
          await dbContext.SaveChangesAsync(ct);
          _logger.LogInformation(
            "Enqueued JURA-status SMS for order {OrderId}, status_id={StatusId}",
            order.Id, juraStatusId);
        }
        catch (DbUpdateException dupEx) when (IsDuplicateConstraintViolation(dupEx))
        {
          dbContext.Entry(outboxMessage).State = EntityState.Detached;
          _logger.LogDebug(
            "Duplicate JURA SMS skipped. OrderId={OrderId}, jura:{StatusId}",
            order.Id, juraStatusId);
        }
        return;
      }
      catch (Exception ex)
      {
        _logger.LogWarning(ex,
          "Failed to enqueue SMS for order {OrderId}, JURA status {StatusId} — will try Telegram fallback",
          order.Id, juraStatusId);
      }
    }

    // Fallback: Telegram (for clients without phone OR when SMS threw).
    if (telegramBot is null || !order.ClientId.HasValue)
    {
      _logger.LogInformation(
        "JURA status {StatusId} for order {OrderId}: no SMS channel and no Telegram fallback available.",
        juraStatusId, order.Id);
      return;
    }

    var telegramId = await dbContext.Users
      .AsNoTracking()
      .Where(u => u.Id == order.ClientId.Value)
      .Select(u => u.TelegramId)
      .FirstOrDefaultAsync(ct);

    if (!telegramId.HasValue)
    {
      _logger.LogInformation(
        "JURA status {StatusId} for order {OrderId}: client has no TelegramId — notification skipped.",
        juraStatusId, order.Id);
      return;
    }

    try
    {
      await telegramBot.SendMessageAsync(telegramId.Value, message, ct);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex,
        "Telegram send exception for order {OrderId}, JURA status {StatusId}, chatId {ChatId}",
        order.Id, juraStatusId, telegramId);
    }
  }

  private static bool IsDuplicateConstraintViolation(DbUpdateException exception)
  {
    if (exception.InnerException is PostgresException pg)
      return string.Equals(pg.SqlState, "23505", StringComparison.Ordinal);
    var msg = exception.InnerException?.Message ?? string.Empty;
    return msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
      || msg.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase);
  }
}
