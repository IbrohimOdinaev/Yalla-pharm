using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Payments;

public sealed class ManualPaymentTimeoutHostedService : BackgroundService
{
  private const int BatchSize = 100;

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly DushanbeCityPaymentOptions _options;
  private readonly ILogger<ManualPaymentTimeoutHostedService> _logger;

  public ManualPaymentTimeoutHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<DushanbeCityPaymentOptions> options,
    ILogger<ManualPaymentTimeoutHostedService> logger)
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
      "Manual payment timeout worker started. IntervalSeconds={IntervalSeconds}.",
      intervalSeconds);

    await CleanupExpiredOrdersAsync(stoppingToken);
    while (!stoppingToken.IsCancellationRequested
      && await timer.WaitForNextTickAsync(stoppingToken))
    {
      await CleanupExpiredOrdersAsync(stoppingToken);
    }
  }

  private async Task CleanupExpiredOrdersAsync(CancellationToken cancellationToken)
  {
    try
    {
      var nowUtc = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

      using var scope = _scopeFactory.CreateScope();
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

      var expiredOrders = await dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .Where(x =>
          x.Status == Status.New
          && x.PaymentState == OrderPaymentState.PendingManualConfirmation
          && x.PaymentExpiresAtUtc.HasValue
          && x.PaymentExpiresAtUtc.Value <= nowUtc)
        .OrderBy(x => x.PaymentExpiresAtUtc)
        .Take(BatchSize)
        .ToListAsync(cancellationToken);

      if (expiredOrders.Count == 0)
        return;

      await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
      try
      {
        foreach (var order in expiredOrders)
        {
          order.MarkManualPaymentExpired(nowUtc);

          await RestoreStockAsync(dbContext, order, cancellationToken);
          await RestoreBasketAsync(dbContext, order, cancellationToken);

          dbContext.Orders.Remove(order);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
      }
      catch (Exception)
      {
        await transaction.RollbackAsync(cancellationToken);
        throw;
      }

      _logger.LogInformation(
        "Manual payment timeout cleanup removed {OrdersCount} orders.",
        expiredOrders.Count);
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Manual payment timeout cleanup failed.");
    }
  }

  private static async Task RestoreStockAsync(
    AppDbContext dbContext,
    Order order,
    CancellationToken cancellationToken)
  {
    var acceptedByMedicine = order.Positions
      .Where(x => !x.IsRejected)
      .GroupBy(x => x.MedicineId)
      .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

    foreach (var position in acceptedByMedicine)
    {
      await dbContext.Offers
        .Where(x => x.PharmacyId == order.PharmacyId && x.MedicineId == position.Key)
        .ExecuteUpdateAsync(
          setters => setters.SetProperty(
            x => x.StockQuantity,
            x => x.StockQuantity + position.Value),
          cancellationToken);
    }
  }

  private static async Task RestoreBasketAsync(
    AppDbContext dbContext,
    Order order,
    CancellationToken cancellationToken)
  {
    if (!order.ClientId.HasValue)
      return;

    var clientId = order.ClientId.Value;
    var acceptedByMedicine = order.Positions
      .Where(x => !x.IsRejected)
      .GroupBy(x => x.MedicineId)
      .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

    if (acceptedByMedicine.Count == 0)
      return;

    var medicineIds = acceptedByMedicine.Keys.ToList();
    var existingPositions = await dbContext.BasketPositions
      .AsTracking()
      .Where(x => x.ClientId == clientId && medicineIds.Contains(x.MedicineId))
      .ToListAsync(cancellationToken);

    var existingByMedicine = existingPositions.ToDictionary(x => x.MedicineId, x => x);
    foreach (var item in acceptedByMedicine)
    {
      if (existingByMedicine.TryGetValue(item.Key, out var position))
      {
        position.SetQuantity(position.Quantity + item.Value);
      }
      else
      {
        dbContext.BasketPositions.Add(new BasketPosition(
          clientId,
          item.Key,
          medicine: null,
          quantity: item.Value));
      }
    }
  }
}
