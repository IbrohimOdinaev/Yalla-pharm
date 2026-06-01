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
/// Enqueues Telegram notifications for prescription-request status changes.
/// </summary>
public sealed class PrescriptionStatusTelegramEnqueueHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly TelegramOutboxOptions _options;
  private readonly ILogger<PrescriptionStatusTelegramEnqueueHostedService> _logger;

  public PrescriptionStatusTelegramEnqueueHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<TelegramOutboxOptions> options,
    ILogger<PrescriptionStatusTelegramEnqueueHostedService> logger)
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
      _logger.LogInformation("Prescription status Telegram enqueue worker is disabled by configuration.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "Prescription status Telegram enqueue worker started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}",
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
      var messageService = scope.ServiceProvider.GetRequiredService<IClientTelegramNotificationMessageService>();

      var nowUtc = DateTime.UtcNow;
      var batchSize = Math.Max(1, _options.BatchSize);
      var notifiableStatuses = Enum.GetValues<PrescriptionStatus>();
      var maxAgeHours = Math.Max(1, _options.CatchUpMaxOrderAgeHours);
      var cutoffUtc = nowUtc.AddHours(-maxAgeHours);

      var candidates = await (
        from prescription in dbContext.Prescriptions.AsNoTracking()
        join user in dbContext.Users.AsNoTracking() on prescription.ClientId equals user.Id
        where user.TelegramId.HasValue
          && notifiableStatuses.Contains(prescription.Status)
          && (prescription.UpdatedAtUtc ?? prescription.CreatedAtUtc) >= cutoffUtc
          && !dbContext.TelegramOutboxMessages.Any(m =>
            m.PrescriptionId == prescription.Id
            && m.PrescriptionStatusSnapshot == prescription.Status
            && m.ChatId == user.TelegramId.Value
            && m.MessageKey == null)
        orderby (prescription.UpdatedAtUtc ?? prescription.CreatedAtUtc) descending
        select new
        {
          prescription.Id,
          ChatId = user.TelegramId!.Value,
          prescription.Status
        })
        .Take(batchSize)
        .ToListAsync(cancellationToken);

      if (candidates.Count == 0)
        return;

      var insertedCount = 0;
      foreach (var candidate in candidates)
      {
        var message = messageService.BuildPrescriptionMessage(candidate.Id, candidate.Status);
        if (string.IsNullOrWhiteSpace(message))
          continue;

        var outboxMessage = TelegramOutboxMessage.CreatePendingForPrescription(
          prescriptionId: candidate.Id,
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
            "Skipped duplicate Telegram outbox message. PrescriptionId={PrescriptionId}, Status={Status}, ChatId={ChatId}",
            candidate.Id,
            candidate.Status,
            candidate.ChatId);
        }
      }

      if (insertedCount > 0)
      {
        _logger.LogInformation(
          "Enqueued {Count} prescription-status Telegram outbox messages.",
          insertedCount);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Prescription status Telegram enqueue worker failed.");
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
