using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Sms;

public sealed class SmsOutboxDispatcherHostedService : BackgroundService
{
  private static readonly HashSet<string> TransientErrors = new(StringComparer.OrdinalIgnoreCase)
  {
    "transport_error",
    "provider_limit",
    "unknown_provider_error"
  };

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly SmsOutboxOptions _options;
  private readonly ILogger<SmsOutboxDispatcherHostedService> _logger;

  public SmsOutboxDispatcherHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<SmsOutboxOptions> options,
    ILogger<SmsOutboxDispatcherHostedService> logger)
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
      _logger.LogInformation("SMS outbox dispatcher is disabled by configuration.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "SMS outbox dispatcher started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}, MaxAttempts={MaxAttempts}",
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
      var smsSender = scope.ServiceProvider.GetRequiredService<ISmsSender>();

      var nowUtc = DateTime.UtcNow;
      var batchSize = Math.Max(1, _options.BatchSize);
      var maxAttempts = Math.Max(1, _options.MaxAttempts);
      var retryBackoffSeconds = Math.Max(1, _options.RetryBackoffSeconds);

      var dueIds = await dbContext.SmsOutboxMessages
        .AsNoTracking()
        .Where(x => x.State == SmsOutboxState.Pending && x.NextAttemptAtUtc <= nowUtc)
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
        var claimed = await dbContext.SmsOutboxMessages
          .Where(x =>
            x.Id == id
            && x.State == SmsOutboxState.Pending
            && x.NextAttemptAtUtc <= nowUtc)
          .ExecuteUpdateAsync(
            setters => setters
              .SetProperty(x => x.State, SmsOutboxState.Processing)
              .SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1)
              .SetProperty(x => x.UpdatedAtUtc, nowUtc),
            cancellationToken);

        if (claimed == 0)
          continue;

        var message = await dbContext.SmsOutboxMessages
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (message is null)
          continue;

        try
        {
          var txnId = string.IsNullOrWhiteSpace(message.TxnId)
            ? Guid.NewGuid().ToString("N")
            : message.TxnId!;

          var sendResult = await smsSender.SendSmsAsync(
            new SmsSendCommand
            {
              PhoneNumber = message.PhoneNumber,
              Message = message.Message,
              TxnId = txnId,
              IsConfidential = true
            },
            cancellationToken);

          if (sendResult.IsSuccess)
          {
            message.MarkSent(
              sentAtUtc: nowUtc,
              txnId: sendResult.TxnId ?? txnId,
              msgId: sendResult.MsgId);
          }
          else
          {
            var isTransient = IsTransient(sendResult.ErrorCode);
            var shouldRetry = isTransient && message.AttemptCount < maxAttempts;

            if (shouldRetry)
            {
              var retryDelay = CalculateBackoff(message.AttemptCount - 1, retryBackoffSeconds);
              message.ScheduleRetry(
                nextAttemptAtUtc: nowUtc.Add(retryDelay),
                errorCode: sendResult.ErrorCode,
                errorMessage: sendResult.ErrorMessage,
                txnId: sendResult.TxnId ?? txnId,
                msgId: sendResult.MsgId);
            }
            else
            {
              message.MarkFailed(
                failedAtUtc: nowUtc,
                errorCode: sendResult.ErrorCode,
                errorMessage: sendResult.ErrorMessage,
                txnId: sendResult.TxnId ?? txnId,
                msgId: sendResult.MsgId);
            }
          }

          await dbContext.SaveChangesAsync(cancellationToken);
          processed++;
        }
        catch (OperationCanceledException)
        {
          throw;
        }
        catch (Exception exception)
        {
          _logger.LogError(
            exception,
            "SMS outbox dispatcher failed for message. MessageId={MessageId}, OrderId={OrderId}",
            message.Id,
            message.OrderId);

          if (message.AttemptCount >= maxAttempts)
          {
            message.MarkFailed(
              failedAtUtc: nowUtc,
              errorCode: "transport_error",
              errorMessage: "Unhandled dispatch error.");
          }
          else
          {
            var retryDelay = CalculateBackoff(message.AttemptCount - 1, retryBackoffSeconds);
            message.ScheduleRetry(
              nextAttemptAtUtc: nowUtc.Add(retryDelay),
              errorCode: "transport_error",
              errorMessage: "Unhandled dispatch error.");
          }

          await dbContext.SaveChangesAsync(cancellationToken);
        }
      }

      await CleanupRetentionAsync(dbContext, nowUtc, cancellationToken);

      if (processed > 0)
      {
        _logger.LogInformation(
          "SMS outbox dispatcher processed {Count} messages.",
          processed);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "SMS outbox dispatcher failed.");
    }
  }

  private async Task CleanupRetentionAsync(
    AppDbContext dbContext,
    DateTime nowUtc,
    CancellationToken cancellationToken)
  {
    var retentionDays = Math.Max(1, _options.RetentionDays);
    var threshold = nowUtc.AddDays(-retentionDays);

    var removed = await dbContext.SmsOutboxMessages
      .Where(x =>
        (x.State == SmsOutboxState.Sent || x.State == SmsOutboxState.Failed)
        && x.UpdatedAtUtc <= threshold)
      .ExecuteDeleteAsync(cancellationToken);

    if (removed > 0)
    {
      _logger.LogInformation(
        "SMS outbox retention cleanup removed {Count} messages.",
        removed);
    }
  }

  private static TimeSpan CalculateBackoff(int attempt, int retryBackoffSeconds)
  {
    var safeAttempt = Math.Max(0, attempt);
    var multiplier = Math.Pow(2, safeAttempt);
    return TimeSpan.FromSeconds(retryBackoffSeconds * multiplier);
  }

  private static bool IsTransient(string? errorCode)
  {
    if (string.IsNullOrWhiteSpace(errorCode))
      return false;

    return TransientErrors.Contains(errorCode);
  }
}
