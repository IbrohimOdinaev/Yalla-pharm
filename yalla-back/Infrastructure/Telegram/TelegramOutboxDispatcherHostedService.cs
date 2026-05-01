using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Telegram;

/// <summary>
/// Drains pending <see cref="Yalla.Domain.Entities.TelegramOutboxMessage"/> rows by calling
/// <see cref="ITelegramBotApi.SendMessageAsync"/>. Mirrors the SMS dispatcher: claim row →
/// send → mark Sent / ScheduleRetry / MarkFailed; transient errors retry with exponential
/// backoff up to <see cref="TelegramOutboxOptions.MaxAttempts"/>.
/// </summary>
public sealed class TelegramOutboxDispatcherHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly TelegramOutboxOptions _options;
  private readonly ILogger<TelegramOutboxDispatcherHostedService> _logger;

  public TelegramOutboxDispatcherHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<TelegramOutboxOptions> options,
    ILogger<TelegramOutboxDispatcherHostedService> logger)
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
      _logger.LogInformation("Telegram outbox dispatcher is disabled by configuration.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "Telegram outbox dispatcher started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}, MaxAttempts={MaxAttempts}",
      interval.TotalSeconds,
      Math.Max(1, _options.BatchSize),
      Math.Max(1, _options.MaxAttempts));

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
      var telegramBot = scope.ServiceProvider.GetRequiredService<ITelegramBotApi>();

      var nowUtc = DateTime.UtcNow;
      var batchSize = Math.Max(1, _options.BatchSize);
      var maxAttempts = Math.Max(1, _options.MaxAttempts);
      var retryBackoffSeconds = Math.Max(1, _options.RetryBackoffSeconds);

      var dueIds = await dbContext.TelegramOutboxMessages
        .AsNoTracking()
        .Where(x => x.State == TelegramOutboxState.Pending && x.NextAttemptAtUtc <= nowUtc)
        .OrderBy(x => x.NextAttemptAtUtc)
        .ThenBy(x => x.CreatedAtUtc)
        .Select(x => x.Id)
        .Take(batchSize)
        .ToListAsync(cancellationToken);

      if (dueIds.Count == 0)
      {
        await CleanupRetentionAsync(dbContext, nowUtc, cancellationToken);
        return;
      }

      var processed = 0;
      foreach (var id in dueIds)
      {
        var claimed = await dbContext.TelegramOutboxMessages
          .Where(x =>
            x.Id == id
            && x.State == TelegramOutboxState.Pending
            && x.NextAttemptAtUtc <= nowUtc)
          .ExecuteUpdateAsync(
            setters => setters
              .SetProperty(x => x.State, TelegramOutboxState.Processing)
              .SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1)
              .SetProperty(x => x.UpdatedAtUtc, nowUtc),
            cancellationToken);

        if (claimed == 0)
          continue;

        var message = await dbContext.TelegramOutboxMessages
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (message is null)
          continue;

        try
        {
          await telegramBot.SendMessageAsync(message.ChatId, message.Message, cancellationToken);
          // Telegram bot api wrapper doesn't expose message_id from SendMessageAsync; record null.
          message.MarkSent(sentAtUtc: nowUtc, telegramMessageId: null);
          await dbContext.SaveChangesAsync(cancellationToken);
          processed++;
        }
        catch (OperationCanceledException)
        {
          throw;
        }
        catch (Exception exception)
        {
          var errorCode = ClassifyError(exception, out var isTerminal);
          var errorMessage = exception.Message?.Length > 512 ? exception.Message[..512] : exception.Message;

          if (isTerminal || message.AttemptCount >= maxAttempts)
          {
            message.MarkFailed(failedAtUtc: nowUtc, errorCode: errorCode, errorMessage: errorMessage);
            _logger.LogWarning(
              exception,
              "Telegram outbox dispatch permanently failed. MessageId={MessageId}, OrderId={OrderId}, ChatId={ChatId}, ErrorCode={ErrorCode}",
              message.Id,
              message.OrderId,
              message.ChatId,
              errorCode);
          }
          else
          {
            var retryDelay = CalculateBackoff(message.AttemptCount - 1, retryBackoffSeconds);
            message.ScheduleRetry(
              nextAttemptAtUtc: nowUtc.Add(retryDelay),
              errorCode: errorCode,
              errorMessage: errorMessage);
            _logger.LogInformation(
              "Telegram outbox dispatch transient error, retry scheduled. MessageId={MessageId}, ChatId={ChatId}, AttemptsSoFar={Attempt}, RetryAfterSeconds={Delay}, ErrorCode={ErrorCode}",
              message.Id,
              message.ChatId,
              message.AttemptCount,
              retryDelay.TotalSeconds,
              errorCode);
          }

          await dbContext.SaveChangesAsync(cancellationToken);
        }
      }

      await CleanupRetentionAsync(dbContext, nowUtc, cancellationToken);

      if (processed > 0)
      {
        _logger.LogInformation(
          "Telegram outbox dispatcher processed {Count} messages.",
          processed);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Telegram outbox dispatcher failed.");
    }
  }

  private async Task CleanupRetentionAsync(
    AppDbContext dbContext,
    DateTime nowUtc,
    CancellationToken cancellationToken)
  {
    var retentionDays = Math.Max(1, _options.RetentionDays);
    var threshold = nowUtc.AddDays(-retentionDays);

    var removed = await dbContext.TelegramOutboxMessages
      .Where(x =>
        (x.State == TelegramOutboxState.Sent || x.State == TelegramOutboxState.Failed)
        && x.UpdatedAtUtc <= threshold)
      .ExecuteDeleteAsync(cancellationToken);

    if (removed > 0)
    {
      _logger.LogInformation(
        "Telegram outbox retention cleanup removed {Count} messages.",
        removed);
    }
  }

  private static TimeSpan CalculateBackoff(int attempt, int retryBackoffSeconds)
  {
    var safeAttempt = Math.Max(0, attempt);
    var multiplier = Math.Pow(2, safeAttempt);
    return TimeSpan.FromSeconds(retryBackoffSeconds * multiplier);
  }

  // Telegram API errors are surfaced by TelegramBotApi as InvalidOperationException with the
  // message "...returned HTTP {code}: {body}" or "...error: {description}". We classify by
  // sniffing both for terminal cases that should never be retried (user blocked the bot,
  // chat not found, bad request that won't change on retry).
  private static string ClassifyError(Exception exception, out bool isTerminal)
  {
    isTerminal = false;
    var text = exception.Message ?? string.Empty;

    if (text.Contains("403", StringComparison.Ordinal)
      || text.Contains("blocked", StringComparison.OrdinalIgnoreCase)
      || text.Contains("user is deactivated", StringComparison.OrdinalIgnoreCase))
    {
      isTerminal = true;
      return "user_blocked";
    }

    if (text.Contains("400", StringComparison.Ordinal)
      || text.Contains("chat not found", StringComparison.OrdinalIgnoreCase))
    {
      isTerminal = true;
      return "chat_invalid";
    }

    if (text.Contains("401", StringComparison.Ordinal))
    {
      isTerminal = true;
      return "config_invalid";
    }

    return "transport_error";
  }
}
