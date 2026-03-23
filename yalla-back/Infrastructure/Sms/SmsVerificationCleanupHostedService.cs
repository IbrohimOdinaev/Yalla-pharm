using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Sms;

public sealed class SmsVerificationCleanupHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly SmsVerificationOptions _options;
  private readonly ILogger<SmsVerificationCleanupHostedService> _logger;

  public SmsVerificationCleanupHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<SmsVerificationOptions> options,
    ILogger<SmsVerificationCleanupHostedService> logger)
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
    var intervalMinutes = Math.Max(1, _options.CleanupIntervalMinutes);
    using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

    _logger.LogInformation(
      "SMS cleanup worker started. IntervalMinutes={IntervalMinutes}, ExpiredRetentionMinutes={ExpiredRetentionMinutes}, CompletedRetentionHours={CompletedRetentionHours}",
      intervalMinutes,
      Math.Max(10, _options.ExpiredSessionRetentionMinutes),
      Math.Max(1, _options.CompletedSessionRetentionHours));

    await CleanupAsync(stoppingToken);
    while (!stoppingToken.IsCancellationRequested
      && await timer.WaitForNextTickAsync(stoppingToken))
    {
      await CleanupAsync(stoppingToken);
    }
  }

  private async Task CleanupAsync(CancellationToken cancellationToken)
  {
    try
    {
      var nowUtc = DateTime.UtcNow;
      var expiredRetentionMinutes = Math.Max(10, _options.ExpiredSessionRetentionMinutes);
      var completedRetentionHours = Math.Max(1, _options.CompletedSessionRetentionHours);
      var expiredThresholdUtc = nowUtc.AddMinutes(-expiredRetentionMinutes);
      var completedThresholdUtc = nowUtc.AddHours(-completedRetentionHours);

      using var scope = _scopeFactory.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

      var deletedExpiredPending = await dbContext.SmsVerificationSessions
        .Where(x => x.Status == SmsVerificationStatus.Pending && x.ExpiresAtUtc <= expiredThresholdUtc)
        .ExecuteDeleteAsync(cancellationToken);

      var deletedCompleted = await dbContext.SmsVerificationSessions
        .Where(x => x.Status != SmsVerificationStatus.Pending && x.UpdatedAtUtc <= completedThresholdUtc)
        .ExecuteDeleteAsync(cancellationToken);

      var totalDeleted = deletedExpiredPending + deletedCompleted;
      if (totalDeleted > 0)
      {
        _logger.LogInformation(
          "SMS cleanup removed {TotalDeleted} sessions (expiredPending={ExpiredPending}, completed={Completed}).",
          totalDeleted,
          deletedExpiredPending,
          deletedCompleted);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "SMS cleanup worker failed.");
    }
  }
}
