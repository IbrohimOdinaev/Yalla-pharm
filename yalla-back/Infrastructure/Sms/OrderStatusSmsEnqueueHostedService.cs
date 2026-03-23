using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Sms;

public sealed class OrderStatusSmsEnqueueHostedService : BackgroundService
{
  private readonly IServiceScopeFactory _scopeFactory;
  private readonly SmsOutboxOptions _options;
  private readonly SmsTemplatesOptions _templatesOptions;
  private readonly ILogger<OrderStatusSmsEnqueueHostedService> _logger;

  public OrderStatusSmsEnqueueHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<SmsOutboxOptions> options,
    IOptions<SmsTemplatesOptions> templatesOptions,
    ILogger<OrderStatusSmsEnqueueHostedService> logger)
  {
    ArgumentNullException.ThrowIfNull(scopeFactory);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(templatesOptions);
    ArgumentNullException.ThrowIfNull(logger);

    _scopeFactory = scopeFactory;
    _options = options.Value;
    _templatesOptions = templatesOptions.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    if (!_options.Enabled)
    {
      _logger.LogInformation("Order status SMS enqueue worker is disabled by configuration.");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(5, _options.PollIntervalSeconds));
    using var timer = new PeriodicTimer(interval);

    _logger.LogInformation(
      "Order status SMS enqueue worker started. PollIntervalSeconds={PollIntervalSeconds}, BatchSize={BatchSize}",
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
      var provider = string.IsNullOrWhiteSpace(_templatesOptions.Provider)
        ? "OsonSms"
        : _templatesOptions.Provider.Trim();

      var candidates = await dbContext.Orders
        .AsNoTracking()
        .Where(x => !string.IsNullOrWhiteSpace(x.ClientPhoneNumber))
        .Where(x => !dbContext.SmsOutboxMessages.Any(m =>
          m.OrderId == x.Id
          && m.StatusSnapshot == x.Status
          && m.PhoneNumber == x.ClientPhoneNumber))
        .OrderByDescending(x => x.OrderPlacedAt)
        .Take(batchSize)
        .Select(x => new
        {
          x.Id,
          x.ClientPhoneNumber,
          x.Status
        })
        .ToListAsync(cancellationToken);

      if (candidates.Count == 0)
        return;

      var insertedCount = 0;
      foreach (var candidate in candidates)
      {
        var message = orderStatusSmsService.BuildMessage(candidate.Id, candidate.Status);
        if (string.IsNullOrWhiteSpace(message))
          continue;

        var outboxMessage = SmsOutboxMessage.CreatePending(
          orderId: candidate.Id,
          phoneNumber: candidate.ClientPhoneNumber,
          statusSnapshot: candidate.Status,
          message: message,
          provider: provider,
          nowUtc: nowUtc);

        dbContext.SmsOutboxMessages.Add(outboxMessage);

        try
        {
          await dbContext.SaveChangesAsync(cancellationToken);
          insertedCount++;
        }
        catch (DbUpdateException exception) when (IsDuplicateConstraintViolation(exception))
        {
          dbContext.Entry(outboxMessage).State = EntityState.Detached;
          _logger.LogDebug(
            "Skipped duplicate SMS outbox message. OrderId={OrderId}, Status={Status}, Phone={Phone}",
            candidate.Id,
            candidate.Status,
            candidate.ClientPhoneNumber);
        }
      }

      if (insertedCount > 0)
      {
        _logger.LogInformation(
          "Enqueued {Count} order-status SMS outbox messages.",
          insertedCount);
      }
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Order status SMS enqueue worker failed.");
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
