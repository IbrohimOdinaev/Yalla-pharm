using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Yalla.Application.Abstractions;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Telegram;

/// <summary>
/// Periodically marks expired Pending sessions and deletes old terminal ones.
/// </summary>
public sealed class TelegramAuthSessionCleanupHostedService : BackgroundService
{
  private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(5);
  private static readonly TimeSpan TerminalRetention = TimeSpan.FromHours(24);

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly ILogger<TelegramAuthSessionCleanupHostedService> _logger;

  public TelegramAuthSessionCleanupHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<TelegramAuthSessionCleanupHostedService> logger)
  {
    _scopeFactory = scopeFactory;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    while (!stoppingToken.IsCancellationRequested)
    {
      try
      {
        await SweepAsync(stoppingToken);
      }
      catch (OperationCanceledException) { }
      catch (Exception ex)
      {
        _logger.LogError(ex, "TelegramAuthSession cleanup failed.");
      }

      try
      {
        await Task.Delay(SweepInterval, stoppingToken);
      }
      catch (OperationCanceledException) { return; }
    }
  }

  private async Task SweepAsync(CancellationToken cancellationToken)
  {
    using var scope = _scopeFactory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
    var nowUtc = DateTime.UtcNow;
    var purgeBefore = nowUtc - TerminalRetention;

    var expired = await dbContext.TelegramAuthSessions
      .Where(x => x.Status == TelegramAuthSessionStatus.Pending && x.ExpiresAtUtc <= nowUtc)
      .ExecuteUpdateAsync(setters => setters
        .SetProperty(x => x.Status, TelegramAuthSessionStatus.Expired)
        .SetProperty(x => x.UpdatedAtUtc, nowUtc),
        cancellationToken);

    var deleted = await dbContext.TelegramAuthSessions
      .Where(x => x.Status != TelegramAuthSessionStatus.Pending && x.UpdatedAtUtc <= purgeBefore)
      .ExecuteDeleteAsync(cancellationToken);

    if (expired > 0 || deleted > 0)
    {
      _logger.LogInformation(
        "TelegramAuthSession cleanup: marked {Expired} expired, deleted {Deleted} old.",
        expired,
        deleted);
    }
  }
}
