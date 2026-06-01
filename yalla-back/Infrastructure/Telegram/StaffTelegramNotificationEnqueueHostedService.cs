using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Yalla.Application.Common;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Telegram;

public sealed class StaffTelegramNotificationEnqueueHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly StaffTelegramNotificationOptions _options;
  private readonly TelegramAuthOptions _telegramAuthOptions;
  private readonly ILogger<StaffTelegramNotificationEnqueueHostedService> _logger;

  public StaffTelegramNotificationEnqueueHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<StaffTelegramNotificationOptions> options,
    IOptions<TelegramAuthOptions> telegramAuthOptions,
    ILogger<StaffTelegramNotificationEnqueueHostedService> logger)
  {
    ArgumentNullException.ThrowIfNull(scopeFactory);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(telegramAuthOptions);
    ArgumentNullException.ThrowIfNull(logger);

    _scopeFactory = scopeFactory;
    _options = options.Value;
    _telegramAuthOptions = telegramAuthOptions.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    if (!_options.Enabled)
    {
      _logger.LogInformation("Staff Telegram enqueue worker is disabled by configuration.");
      return;
    }

    if (string.IsNullOrWhiteSpace(_options.BotToken))
    {
      _logger.LogWarning("Staff Telegram enqueue worker is enabled but BotToken is empty.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "Staff Telegram enqueue worker started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}",
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
      var nowUtc = DateTime.UtcNow;

      var orderCount = await EnqueueOrderNotificationsAsync(dbContext, nowUtc, cancellationToken);
      var lookupCount = await EnqueueManualLookupNotificationsAsync(dbContext, nowUtc, cancellationToken);

      if (orderCount + lookupCount > 0)
      {
        _logger.LogInformation(
          "Enqueued staff Telegram notifications. Orders={OrderCount}, ManualLookups={ManualLookupCount}",
          orderCount,
          lookupCount);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Staff Telegram enqueue worker failed.");
    }
  }

  private async Task<int> EnqueueOrderNotificationsAsync(
    AppDbContext dbContext,
    DateTime nowUtc,
    CancellationToken cancellationToken)
  {
    var batchSize = Math.Max(1, _options.BatchSize);
    var maxAgeHours = Math.Max(1, _options.CatchUpMaxOrderAgeHours);
    var cutoffPlacedAt = DateTime.SpecifyKind(
      DateTime.UtcNow.AddHours(5).AddHours(-maxAgeHours),
      DateTimeKind.Unspecified);

    var candidates = await (
      from order in dbContext.Orders.AsNoTracking()
      join pharmacy in dbContext.Pharmacies.AsNoTracking() on order.PharmacyId equals pharmacy.Id
      join worker in dbContext.PharmacyWorkers.AsNoTracking() on order.PharmacyId equals worker.PharmacyId
      where order.Status == Status.UnderReview
        && order.OrderPlacedAt >= cutoffPlacedAt
        && pharmacy.IsActive
        && worker.IsActive
        && worker.TelegramId.HasValue
        && !dbContext.StaffTelegramOutboxMessages.Any(m =>
          m.OrderId == order.Id
          && m.PharmacyWorkerId == worker.Id)
      orderby order.OrderPlacedAt descending
      select new
      {
        order.Id,
        order.Cost,
        order.PaymentCurrency,
        order.IsPickup,
        PharmacyTitle = pharmacy.Title,
        WorkerId = worker.Id,
        PharmacyId = pharmacy.Id,
        ChatId = worker.TelegramId!.Value
      })
      .Take(batchSize)
      .ToListAsync(cancellationToken);

    var insertedCount = 0;
    foreach (var candidate in candidates)
    {
      var message = BuildOrderMessage(
        candidate.Id,
        candidate.PharmacyTitle,
        candidate.Cost,
        candidate.PaymentCurrency,
        candidate.IsPickup);

      var outboxMessage = StaffTelegramOutboxMessage.CreateForOrder(
        orderId: candidate.Id,
        pharmacyId: candidate.PharmacyId,
        pharmacyWorkerId: candidate.WorkerId,
        chatId: candidate.ChatId,
        message: message,
        nowUtc: nowUtc);

      dbContext.StaffTelegramOutboxMessages.Add(outboxMessage);
      insertedCount += await SaveSkippingDuplicateAsync(dbContext, outboxMessage, cancellationToken);
    }

    return insertedCount;
  }

  private async Task<int> EnqueueManualLookupNotificationsAsync(
    AppDbContext dbContext,
    DateTime nowUtc,
    CancellationToken cancellationToken)
  {
    var batchSize = Math.Max(1, _options.BatchSize);
    var maxAgeHours = Math.Max(1, _options.CatchUpMaxLookupAgeHours);
    var cutoffCreatedAtUtc = DateTime.UtcNow.AddHours(-maxAgeHours);

    var candidates = await (
      from request in dbContext.ManualItemLookupRequests.AsNoTracking()
      from worker in dbContext.PharmacyWorkers.AsNoTracking()
      where request.Status == ManualItemLookupRequestStatus.Open
        && request.CreatedAtUtc >= cutoffCreatedAtUtc
        && worker.IsActive
        && worker.TelegramId.HasValue
        && !dbContext.StaffTelegramOutboxMessages.Any(m =>
          m.ManualLookupRequestId == request.Id
          && m.PharmacyWorkerId == worker.Id)
      orderby request.CreatedAtUtc descending
      select new
      {
        request.Id,
        request.ManualMedicineName,
        request.RequestComment,
        WorkerId = worker.Id,
        ChatId = worker.TelegramId!.Value
      })
      .Take(batchSize)
      .ToListAsync(cancellationToken);

    var insertedCount = 0;
    foreach (var candidate in candidates)
    {
      var message = BuildManualLookupMessage(
        candidate.Id,
        candidate.ManualMedicineName,
        candidate.RequestComment);

      var outboxMessage = StaffTelegramOutboxMessage.CreateForManualLookup(
        manualLookupRequestId: candidate.Id,
        pharmacyWorkerId: candidate.WorkerId,
        chatId: candidate.ChatId,
        message: message,
        nowUtc: nowUtc);

      dbContext.StaffTelegramOutboxMessages.Add(outboxMessage);
      insertedCount += await SaveSkippingDuplicateAsync(dbContext, outboxMessage, cancellationToken);
    }

    return insertedCount;
  }

  private async Task<int> SaveSkippingDuplicateAsync(
    AppDbContext dbContext,
    StaffTelegramOutboxMessage outboxMessage,
    CancellationToken cancellationToken)
  {
    try
    {
      await dbContext.SaveChangesAsync(cancellationToken);
      return 1;
    }
    catch (DbUpdateException exception) when (IsDuplicateConstraintViolation(exception))
    {
      dbContext.Entry(outboxMessage).State = EntityState.Detached;
      _logger.LogDebug(
        "Skipped duplicate staff Telegram outbox message. MessageKey={MessageKey}, PharmacyWorkerId={PharmacyWorkerId}",
        outboxMessage.MessageKey,
        outboxMessage.PharmacyWorkerId);
      return 0;
    }
  }

  private string BuildOrderMessage(
    Guid orderId,
    string pharmacyTitle,
    decimal cost,
    string currency,
    bool isPickup)
  {
    var link = BuildAbsoluteUrl("/workspace#orders");
    var deliveryType = isPickup ? "самовывоз" : "доставка";
    return string.Join(
      "\n",
      "Yalla Pharm",
      "Новый заказ для сборки",
      $"Аптека: {pharmacyTitle}",
      $"Заказ: #{orderId.ToString("N")[..8]}",
      $"Тип: {deliveryType}",
      $"Сумма: {FormatMoney(cost)} {currency}",
      $"Открыть управление: {link}");
  }

  private string BuildManualLookupMessage(Guid lookupId, string medicineName, string? comment)
  {
    var lines = new List<string>
    {
      "Yalla Pharm",
      "Новый запрос фармацевта на поиск лекарства",
      $"Запрос: #{lookupId.ToString("N")[..8]}",
      $"Лекарство: {medicineName}",
      $"Открыть запросы: {BuildAbsoluteUrl("/workspace/lookups")}"
    };

    if (!string.IsNullOrWhiteSpace(comment))
      lines.Insert(4, $"Комментарий: {comment.Trim()}");

    return string.Join("\n", lines);
  }

  private string BuildAbsoluteUrl(string path)
  {
    var baseUrl = string.IsNullOrWhiteSpace(_options.PublicBaseUrl)
      ? _telegramAuthOptions.WebhookPublicBaseUrl
      : _options.PublicBaseUrl;

    if (string.IsNullOrWhiteSpace(baseUrl))
      baseUrl = "https://pharm.yalla.tj";

    return $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
  }

  private static string FormatMoney(decimal value)
  {
    return value.ToString("0.##", CultureInfo.InvariantCulture);
  }

  private static bool IsDuplicateConstraintViolation(DbUpdateException exception)
  {
    if (exception.InnerException is PostgresException postgresException)
      return string.Equals(postgresException.SqlState, "23505", StringComparison.Ordinal);

    return exception.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
      || exception.InnerException?.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase) == true;
  }
}
