using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;
using Yalla.Infrastructure;
using Yalla.Infrastructure.Payments;

namespace Yalla.Application.UnitTests.Services;

public sealed class ManualPaymentTimeoutHostedServiceTests
{
  [Fact]
  public async Task ExecuteAsync_ShouldDeleteExpiredPendingOrder_AndRestoreBasketAndStock()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;

    var client = TestDbFactory.CreateClient("Client", "900500001");
    var superAdmin = TestDbFactory.CreateUser("SuperAdmin", "900500002", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-1", "A-1", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Medicine-1", "ART-500-1");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 8, price: 10m);

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.Add(offer);
    await db.SaveChangesAsync();

    var orderId = Guid.NewGuid();
    var order = new Order(
      id: orderId,
      clientId: client.Id,
      clientPhoneNumber: client.PhoneNumber,
      pharmacyId: pharmacy.Id,
      deliveryAddress: "Dushanbe",
      positions:
      [
        new OrderPosition(
          orderId: orderId,
          medicineId: medicine.Id,
          medicine: medicine,
          offerSnapshot: new OfferSnapshot(pharmacy.Id, 10m),
          quantity: 2)
      ],
      isPickup: false);

    order.MarkManualPaymentPending(
      amount: order.Cost,
      currency: "TJS",
      provider: "DushanbeCityManualPhone",
      receiverAccount: "9762000087892609",
      paymentUrl: "http://pay.expresspay.tj/?A=9762000087892609&s=20.00&c=test",
      paymentComment: "test",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(2));

    db.Orders.Add(order);
    client.AddOrder(order);
    await db.SaveChangesAsync();

    db.Entry(order).Property(x => x.PaymentExpiresAtUtc).CurrentValue = DateTime.UtcNow.AddMinutes(-2);
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();

    var storedBeforeCleanup = await db.Orders
      .AsNoTracking()
      .FirstAsync(x => x.Id == orderId);
    Assert.Equal(OrderPaymentState.PendingManualConfirmation, storedBeforeCleanup.PaymentState);
    Assert.True(storedBeforeCleanup.PaymentExpiresAtUtc.HasValue);
    Assert.True(storedBeforeCleanup.PaymentExpiresAtUtc.Value <= DateTime.UtcNow);

    using var provider = new ServiceCollection()
      .AddSingleton<AppDbContext>(db)
      .BuildServiceProvider();

    var cleanupService = new ManualPaymentTimeoutHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new DushanbeCityPaymentOptions
      {
        CreateOrderOnlyAfterAdminPaymentConfirmation = false,
        CleanupIntervalSeconds = 30
      }),
      NullLogger<ManualPaymentTimeoutHostedService>.Instance);

    await cleanupService.StartAsync(CancellationToken.None);
    await Task.Delay(1500);
    await cleanupService.StopAsync(CancellationToken.None);

    db.ChangeTracker.Clear();

    var exists = await db.Orders
      .AsNoTracking()
      .AnyAsync(x => x.Id == orderId);
    Assert.False(exists);

    var restoredOffer = await db.Offers
      .AsNoTracking()
      .FirstAsync(x => x.PharmacyId == pharmacy.Id && x.MedicineId == medicine.Id);
    Assert.Equal(10, restoredOffer.StockQuantity);

    var basketPosition = await db.BasketPositions
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.ClientId == client.Id && x.MedicineId == medicine.Id);
    Assert.NotNull(basketPosition);
    Assert.Equal(2, basketPosition!.Quantity);
  }

  [Fact]
  public async Task ExecuteAsync_ShouldKeepPendingOrder_WhenDeadlineNotReached()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;

    var client = TestDbFactory.CreateClient("Client2", "900500003");
    var superAdmin = TestDbFactory.CreateUser("SuperAdmin2", "900500004", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-2", "A-2", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Medicine-2", "ART-500-2");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 5, price: 12m);

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.Add(offer);
    await db.SaveChangesAsync();

    var orderId = Guid.NewGuid();
    var order = new Order(
      id: orderId,
      clientId: client.Id,
      clientPhoneNumber: client.PhoneNumber,
      pharmacyId: pharmacy.Id,
      deliveryAddress: "Dushanbe",
      positions:
      [
        new OrderPosition(
          orderId: orderId,
          medicineId: medicine.Id,
          medicine: medicine,
          offerSnapshot: new OfferSnapshot(pharmacy.Id, 12m),
          quantity: 1)
      ],
      isPickup: false);

    order.MarkManualPaymentPending(
      amount: order.Cost,
      currency: "TJS",
      provider: "DushanbeCityManualPhone",
      receiverAccount: "9762000087892609",
      paymentUrl: "http://pay.expresspay.tj/?A=9762000087892609&s=12.00&c=test2",
      paymentComment: "test2",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(20));

    db.Orders.Add(order);
    client.AddOrder(order);
    await db.SaveChangesAsync();

    using var provider = new ServiceCollection()
      .AddSingleton<AppDbContext>(db)
      .BuildServiceProvider();

    var cleanupService = new ManualPaymentTimeoutHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new DushanbeCityPaymentOptions
      {
        CreateOrderOnlyAfterAdminPaymentConfirmation = false,
        CleanupIntervalSeconds = 30
      }),
      NullLogger<ManualPaymentTimeoutHostedService>.Instance);

    await cleanupService.StartAsync(CancellationToken.None);
    await Task.Delay(1500);
    await cleanupService.StopAsync(CancellationToken.None);

    db.ChangeTracker.Clear();

    var exists = await db.Orders
      .AsNoTracking()
      .AnyAsync(x => x.Id == orderId && x.PaymentState == OrderPaymentState.PendingManualConfirmation);
    Assert.True(exists);
  }
}
