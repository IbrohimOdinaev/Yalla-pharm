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
/// Cancels prescription requests that sit unpaid for more than 24 hours.
/// Mirrors <see cref="ManualPaymentTimeoutHostedService"/> for orders — runs on
/// the same configurable interval and uses a single transaction per batch so
/// either the whole batch advances to <c>Cancelled</c> or none of it does.
/// Once cancelled, the client can hit the resubmit endpoint to clone the
/// prescription with a fresh payment URL.
/// </summary>
public sealed class PrescriptionPaymentTimeoutHostedService : BackgroundService
{
  private const int BatchSize = 100;
  /// <summary>
  /// How long an unpaid prescription is allowed to live before the service
  /// auto-cancels it. Pinned to 24h per product spec — a request that sat for
  /// a full day without payment is treated as the user having walked away.
  /// </summary>
  private static readonly TimeSpan UnpaidTtl = TimeSpan.FromHours(24);

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly DushanbeCityPaymentOptions _options;
  private readonly ILogger<PrescriptionPaymentTimeoutHostedService> _logger;

  public PrescriptionPaymentTimeoutHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<DushanbeCityPaymentOptions> options,
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
    var intervalSeconds = Math.Max(5, _options.CleanupIntervalSeconds);
    using var timer = new PeriodicTimer(TimeSpan.FromSeconds(intervalSeconds));

    _logger.LogInformation(
      "Prescription payment timeout worker started. IntervalSeconds={IntervalSeconds}, UnpaidTtlHours={UnpaidTtlHours}.",
      intervalSeconds,
      UnpaidTtl.TotalHours);

    await CleanupExpiredPrescriptionsAsync(stoppingToken);
    while (!stoppingToken.IsCancellationRequested
      && await timer.WaitForNextTickAsync(stoppingToken))
    {
      await CleanupExpiredPrescriptionsAsync(stoppingToken);
    }
  }

  private async Task CleanupExpiredPrescriptionsAsync(CancellationToken cancellationToken)
  {
    try
    {
      var cutoffUtc = DateTime.UtcNow - UnpaidTtl;

      using var scope = _scopeFactory.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var realtimePublisher = scope.ServiceProvider.GetRequiredService<IRealtimeUpdatesPublisher>();

      // Submitted = uploaded but no payment confirmation yet. Anything still
      // sitting in this state past the cutoff is fair game to cancel.
      var expired = await dbContext.Prescriptions
        .AsTracking()
        .Where(p => p.Status == PrescriptionStatus.Submitted
                 && p.CreatedAtUtc <= cutoffUtc)
        .OrderBy(p => p.CreatedAtUtc)
        .Take(BatchSize)
        .ToListAsync(cancellationToken);

      if (expired.Count == 0)
        return;

      await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
      try
      {
        foreach (var prescription in expired)
        {
          prescription.Cancel();
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
      }
      catch
      {
        await transaction.RollbackAsync(cancellationToken);
        throw;
      }

      // Push an update for each so the client's prescription detail page can
      // refresh without polling. Failures here aren't fatal — the DB transition
      // already committed.
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
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Prescription payment timeout cleanup failed.");
    }
  }
}
