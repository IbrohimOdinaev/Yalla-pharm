using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Telegram;

/// <summary>
/// Mirror of <see cref="Yalla.Infrastructure.Sms.OrderStatusSmsEnqueueHostedService"/> for the
/// Telegram channel. Polls orders and enqueues a <see cref="TelegramOutboxMessage"/> for any
/// (Order, Status, Client.TelegramId) tuple that has no row yet. Skips clients without a bound
/// TelegramId — they continue to receive SMS only.
/// </summary>
public sealed class OrderStatusTelegramEnqueueHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly TelegramOutboxOptions _options;
  private readonly ILogger<OrderStatusTelegramEnqueueHostedService> _logger;

  public OrderStatusTelegramEnqueueHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<TelegramOutboxOptions> options,
    ILogger<OrderStatusTelegramEnqueueHostedService> logger)
  {
    ArgumentNullException.ThrowIfNull(scopeFactory);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(logger);

    _scopeFactory = scopeFactory;
    _options = options.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    if (!_options.Enabled)
    {
      _logger.LogInformation("Order status Telegram enqueue worker is disabled by configuration.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "Order status Telegram enqueue worker started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}",
      interval.TotalSeconds,
      Math.Max(1, _options.BatchSize));

    await RunOnceAsync(stoppingToken);
    while (!stoppingToken.IsCancellationRequested
      && await timer.WaitForNextTickAsync(stoppingToken))
    {
      await RunOnceAsync(stoppingToken);
    }
  }

  public async Task RunOnceAsync(CancellationToken cancellationToken = default)
  {
    try
    {
      using var scope = _scopeFactory.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var orderStatusSmsService = scope.ServiceProvider.GetRequiredService<IOrderStatusSmsService>();

      var nowUtc = DateTime.UtcNow;
      var batchSize = Math.Max(1, _options.BatchSize);

      // Same status set as the SMS enqueue worker — Telegram is free, so notifying on every
      // client-facing transition is the default. PaymentConfirmed has no separate Telegram
      // entry yet (SMS-only); add later if needed.
      var notifiableStatuses = new[]
      {
        Status.UnderReview,
        Status.Preparing,
        Status.Ready,
        Status.OnTheWay,
        Status.DriverArrived,
        Status.Delivered,
        Status.PickedUp,
        Status.Cancelled,
        Status.Returned
      };

      // JOIN Orders → Users (TPH, includes Client subtype) to pick up TelegramId.
      // Skip orders whose client has no bound TelegramId.
      var candidates = await (
        from order in dbContext.Orders.AsNoTracking()
        join user in dbContext.Users.AsNoTracking() on order.ClientId equals user.Id
        where order.ClientId.HasValue
          && user.TelegramId.HasValue
          && notifiableStatuses.Contains(order.Status)
          && !dbContext.TelegramOutboxMessages.Any(m =>
            m.OrderId == order.Id
            && m.StatusSnapshot == order.Status
            && m.ChatId == user.TelegramId.Value
            && m.MessageKey == null)
        orderby order.OrderPlacedAt descending
        select new
        {
          order.Id,
          ChatId = user.TelegramId!.Value,
          order.Status,
          order.Cost,
          order.PaymentCurrency
        })
        .Take(batchSize)
        .ToListAsync(cancellationToken);

      if (candidates.Count == 0)
        return;

      var insertedCount = 0;
      foreach (var candidate in candidates)
      {
        var message = orderStatusSmsService.BuildMessage(candidate.Id, candidate.Status, candidate.Cost, candidate.PaymentCurrency);
        if (string.IsNullOrWhiteSpace(message))
          continue;

        var outboxMessage = TelegramOutboxMessage.CreatePending(
          orderId: candidate.Id,
          chatId: candidate.ChatId,
          statusSnapshot: candidate.Status,
          message: message,
          nowUtc: nowUtc);

        dbContext.TelegramOutboxMessages.Add(outboxMessage);

        try
        {
          await dbContext.SaveChangesAsync(cancellationToken);
          insertedCount++;
        }
        catch (DbUpdateException exception) when (IsDuplicateConstraintViolation(exception))
        {
          dbContext.Entry(outboxMessage).State = EntityState.Detached;
          _logger.LogDebug(
            "Skipped duplicate Telegram outbox message. OrderId={OrderId}, Status={Status}, ChatId={ChatId}",
            candidate.Id,
            candidate.Status,
            candidate.ChatId);
        }
      }

      if (insertedCount > 0)
      {
        _logger.LogInformation(
          "Enqueued {Count} order-status Telegram outbox messages.",
          insertedCount);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Order status Telegram enqueue worker failed.");
    }
  }

  private static bool IsDuplicateConstraintViolation(DbUpdateException exception)
  {
    if (exception.InnerException is PostgresException postgresException)
      return string.Equals(postgresException.SqlState, "23505", StringComparison.Ordinal);

    return exception.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
      || exception.InnerException?.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase) == true;
  }
}
