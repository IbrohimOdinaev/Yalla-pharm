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

public sealed class SuperAdminTelegramNotificationEnqueueHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly SuperAdminTelegramNotificationOptions _options;
  private readonly TelegramAuthOptions _telegramAuthOptions;
  private readonly ILogger<SuperAdminTelegramNotificationEnqueueHostedService> _logger;

  public SuperAdminTelegramNotificationEnqueueHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<SuperAdminTelegramNotificationOptions> options,
    IOptions<TelegramAuthOptions> telegramAuthOptions,
    ILogger<SuperAdminTelegramNotificationEnqueueHostedService> logger)
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
      _logger.LogInformation("SuperAdmin Telegram enqueue worker is disabled by configuration.");
      return;
    }

    if (string.IsNullOrWhiteSpace(_options.BotToken))
    {
      _logger.LogWarning("SuperAdmin Telegram enqueue worker is enabled but BotToken is empty.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "SuperAdmin Telegram enqueue worker started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}",
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
      var prescriptionCount = await EnqueuePrescriptionNotificationsAsync(dbContext, nowUtc, cancellationToken);

      if (orderCount + prescriptionCount > 0)
      {
        _logger.LogInformation(
          "Enqueued SuperAdmin Telegram notifications. Orders={OrderCount}, Prescriptions={PrescriptionCount}",
          orderCount,
          prescriptionCount);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "SuperAdmin Telegram enqueue worker failed.");
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
      from superAdmin in dbContext.Users.AsNoTracking()
      join recipient in dbContext.SuperAdminTelegramRecipients.AsNoTracking() on superAdmin.Id equals recipient.SuperAdminId
      let eventKey = order.Status == Status.Cancelled
        ? "cancelled"
        : order.Status == Status.Returned
          ? "returned"
          : "created"
      where (order.Status == Status.New
          || order.Status == Status.UnderReview
          || order.Status == Status.Cancelled
          || order.Status == Status.Returned)
        && order.OrderPlacedAt >= cutoffPlacedAt
        && pharmacy.IsActive
        && superAdmin.Role == Role.SuperAdmin
        && superAdmin.IsActive
        && recipient.IsActive
        && !dbContext.SuperAdminTelegramOutboxMessages.Any(m =>
          m.OrderId == order.Id
          && m.SuperAdminId == superAdmin.Id
          && m.ChatId == recipient.ChatId
          && ((order.Status == Status.Cancelled && m.MessageKey.EndsWith(":cancelled"))
            || (order.Status == Status.Returned && m.MessageKey.EndsWith(":returned"))
            || ((order.Status == Status.New || order.Status == Status.UnderReview) && m.MessageKey.EndsWith(":created"))))
      orderby order.OrderPlacedAt descending
      select new
      {
        order.Id,
        order.Cost,
        order.PaymentCurrency,
        order.IsPickup,
        order.Status,
        EventKey = eventKey,
        PharmacyTitle = pharmacy.Title,
        SuperAdminId = superAdmin.Id,
        PharmacyId = pharmacy.Id,
        recipient.ChatId
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
        candidate.IsPickup,
        candidate.Status);

      var outboxMessage = SuperAdminTelegramOutboxMessage.CreateForOrder(
        orderId: candidate.Id,
        pharmacyId: candidate.PharmacyId,
        superAdminId: candidate.SuperAdminId,
        chatId: candidate.ChatId,
        eventKey: candidate.EventKey,
        message: message,
        nowUtc: nowUtc);

      dbContext.SuperAdminTelegramOutboxMessages.Add(outboxMessage);
      insertedCount += await SaveSkippingDuplicateAsync(dbContext, outboxMessage, cancellationToken);
    }

    return insertedCount;
  }

  private async Task<int> EnqueuePrescriptionNotificationsAsync(
    AppDbContext dbContext,
    DateTime nowUtc,
    CancellationToken cancellationToken)
  {
    var batchSize = Math.Max(1, _options.BatchSize);
    var maxAgeHours = Math.Max(1, _options.CatchUpMaxPrescriptionAgeHours);
    var cutoffCreatedAtUtc = DateTime.UtcNow.AddHours(-maxAgeHours);

    var candidates = await (
      from prescription in dbContext.Prescriptions.AsNoTracking()
      join client in dbContext.Clients.AsNoTracking() on prescription.ClientId equals client.Id
      from superAdmin in dbContext.Users.AsNoTracking()
      join recipient in dbContext.SuperAdminTelegramRecipients.AsNoTracking() on superAdmin.Id equals recipient.SuperAdminId
      where prescription.CreatedAtUtc >= cutoffCreatedAtUtc
        && superAdmin.Role == Role.SuperAdmin
        && superAdmin.IsActive
        && recipient.IsActive
        && !dbContext.SuperAdminTelegramOutboxMessages.Any(m =>
          m.PrescriptionId == prescription.Id
          && m.SuperAdminId == superAdmin.Id
          && m.ChatId == recipient.ChatId)
      orderby prescription.CreatedAtUtc descending
      select new
      {
        prescription.Id,
        prescription.PatientAge,
        prescription.ClientComment,
        prescription.ClientContacts,
        prescription.Status,
        ClientName = client.Name,
        ClientPhone = client.PhoneNumber,
        SuperAdminId = superAdmin.Id,
        recipient.ChatId
      })
      .Take(batchSize)
      .ToListAsync(cancellationToken);

    var insertedCount = 0;
    foreach (var candidate in candidates)
    {
      var message = BuildPrescriptionMessage(
        candidate.Id,
        candidate.ClientName,
        candidate.ClientPhone,
        candidate.PatientAge,
        candidate.ClientComment,
        candidate.ClientContacts,
        candidate.Status);

      var outboxMessage = SuperAdminTelegramOutboxMessage.CreateForPrescription(
        prescriptionId: candidate.Id,
        superAdminId: candidate.SuperAdminId,
        chatId: candidate.ChatId,
        message: message,
        nowUtc: nowUtc);

      dbContext.SuperAdminTelegramOutboxMessages.Add(outboxMessage);
      insertedCount += await SaveSkippingDuplicateAsync(dbContext, outboxMessage, cancellationToken);
    }

    return insertedCount;
  }

  private async Task<int> SaveSkippingDuplicateAsync(
    AppDbContext dbContext,
    SuperAdminTelegramOutboxMessage outboxMessage,
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
        "Skipped duplicate SuperAdmin Telegram outbox message. MessageKey={MessageKey}, SuperAdminId={SuperAdminId}",
        outboxMessage.MessageKey,
        outboxMessage.SuperAdminId);
      return 0;
    }
  }

  private string BuildOrderMessage(
    Guid orderId,
    string pharmacyTitle,
    decimal cost,
    string currency,
    bool isPickup,
    Status status)
  {
    var link = BuildAbsoluteUrl("/superadmin#orders");
    var deliveryType = isPickup ? "самовывоз" : "доставка";
    var title = status switch
    {
      Status.Cancelled => "Заказ отменён",
      Status.Returned => "Заказ переведён в возврат",
      _ => "Создан новый заказ"
    };

    return string.Join(
      "\n",
      "Yalla Pharm",
      title,
      $"Аптека: {pharmacyTitle}",
      $"Заказ: #{orderId.ToString("N")[..8]}",
      $"Тип: {deliveryType}",
      $"Сумма: {FormatMoney(cost)} {currency}",
      $"Открыть заказ: {link}");
  }

  private string BuildPrescriptionMessage(
    Guid prescriptionId,
    string clientName,
    string clientPhone,
    int patientAge,
    string? comment,
    string? contacts,
    PrescriptionStatus status)
  {
    var lines = new List<string>
    {
      "Yalla Pharm",
      "Создан новый запрос на рецепт",
      $"Запрос: #{prescriptionId.ToString("N")[..8]}",
      $"Статус: {status}",
      $"Клиент: {clientName}",
      $"Телефон: {clientPhone}",
      $"Возраст пациента: {patientAge}",
      $"Открыть запрос: {BuildAbsoluteUrl("/superadmin#prescriptions")}"
    };

    if (!string.IsNullOrWhiteSpace(comment))
      lines.Insert(lines.Count - 1, $"Комментарий: {comment.Trim()}");

    if (!string.IsNullOrWhiteSpace(contacts))
      lines.Insert(lines.Count - 1, $"Контакты: {contacts.Trim()}");

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
