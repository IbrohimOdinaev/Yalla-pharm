using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Payments;

/// <summary>
/// Cancels prescription requests that sit unpaid for longer than
/// <see cref="PrescriptionTimeoutOptions.PaymentTimeoutHours"/>.
/// Idempotent: re-running over an already-cancelled row is a no-op
/// thanks to <c>Prescription.Cancel(PaymentTimeout)</c>'s benign-retry
/// path. Tracks both Submitted (uploaded, no payment URL hit) and
/// AwaitingConfirmation (client clicked pay but SuperAdmin hasn't
/// reviewed) — both states block further progress and should bow out
/// after the timeout window.
///
/// The cleanup itself is exposed as a public method so unit/integration
/// tests can drive it directly without standing up the BackgroundService
/// scheduler.
/// </summary>
public sealed class PrescriptionPaymentTimeoutHostedService : BackgroundService
{
  private const int BatchSize = 100;

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly PrescriptionTimeoutOptions _options;
  private readonly ILogger<PrescriptionPaymentTimeoutHostedService> _logger;

  public PrescriptionPaymentTimeoutHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<PrescriptionTimeoutOptions> options,
    ILogger<PrescriptionPaymentTimeoutHostedService> logger)
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
    var intervalMinutes = Math.Max(1, _options.PaymentTimeoutCheckIntervalMinutes);
    using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

    _logger.LogInformation(
      "Prescription payment timeout worker started. IntervalMinutes={IntervalMinutes}, PaymentTimeoutHours={Hours}.",
      intervalMinutes,
      _options.PaymentTimeoutHours);

    await CancelExpiredAsync(stoppingToken);
    while (!stoppingToken.IsCancellationRequested
      && await timer.WaitForNextTickAsync(stoppingToken))
    {
      await CancelExpiredAsync(stoppingToken);
    }
  }

  /// <summary>
  /// Run a single cleanup sweep. Public so tests can invoke directly
  /// without spinning up the hosted-service scheduler. Catches all
  /// exceptions and logs them — the worker keeps ticking even if one
  /// pass fails. Returns the number of rows cancelled in this pass.
  /// </summary>
  public async Task<int> CancelExpiredAsync(CancellationToken cancellationToken)
  {
    try
    {
      var ttl = TimeSpan.FromHours(Math.Max(1, _options.PaymentTimeoutHours));
      var cutoffUtc = DateTime.UtcNow - ttl;

      using var scope = _scopeFactory.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var realtimePublisher = scope.ServiceProvider.GetRequiredService<IRealtimeUpdatesPublisher>();
      var auditLogger = scope.ServiceProvider.GetService<IAuditLogger>();

      // Both Submitted and AwaitingConfirmation block the request from
      // progressing — neither makes sense to keep alive past the TTL.
      var expired = await dbContext.Prescriptions
        .AsTracking()
        .Where(p => (p.Status == PrescriptionStatus.Submitted
                  || p.Status == PrescriptionStatus.AwaitingConfirmation)
                 && p.CreatedAtUtc <= cutoffUtc)
        .OrderBy(p => p.CreatedAtUtc)
        .Take(BatchSize)
        .ToListAsync(cancellationToken);

      if (expired.Count == 0) return 0;

      await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
      try
      {
        foreach (var prescription in expired)
        {
          // Cancel(PaymentTimeout) is benign-idempotent — already
          // cancelled rows are skipped silently. Status guards on
          // OrderPlaced/MovedToCart still throw, so the query above
          // filters down to the two states that are safe to cancel.
          prescription.Cancel(PrescriptionCancellationReason.PaymentTimeout);

          if (auditLogger is not null)
          {
            await auditLogger.LogAsync(
              AuditAction.StatusChanged,
              entityType: "Prescription",
              entityId: prescription.Id,
              summary: $"Prescription {prescription.Id} auto-cancelled — payment not received within {_options.PaymentTimeoutHours}h.",
              payload: new
              {
                clientId = prescription.ClientId,
                reason = PrescriptionCancellationReason.PaymentTimeout.ToString(),
                createdAtUtc = prescription.CreatedAtUtc,
                cancelledAtUtc = prescription.CancelledAtUtc,
              },
              cancellationToken: cancellationToken);
          }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
      }
      catch
      {
        await transaction.RollbackAsync(cancellationToken);
        throw;
      }

      // Realtime push so the client's prescription page refreshes
      // without polling. Best-effort — DB transition already committed.
      // SMS + Telegram notification is intentionally deferred to a
      // follow-up PR that extends the existing outbox machinery to
      // support non-order-bound messages (today every SmsOutboxMessage
      // / TelegramOutboxMessage row requires an OrderId).
      foreach (var prescription in expired)
      {
        try
        {
          await realtimePublisher.PublishPrescriptionUpdatedAsync(
            prescription.Id,
            prescription.ClientId,
            prescription.Status,
            prescription.AssignedPharmacistId,
            cancellationToken);
        }
        catch (Exception ex)
        {
          _logger.LogWarning(ex,
            "Failed to publish PrescriptionUpdated for {PrescriptionId} after auto-cancel.",
            prescription.Id);
        }
      }

      _logger.LogInformation(
        "Prescription payment timeout cleanup cancelled {PrescriptionsCount} prescriptions.",
        expired.Count);

      return expired.Count;
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Prescription payment timeout cleanup failed.");
      return 0;
    }
  }
}
