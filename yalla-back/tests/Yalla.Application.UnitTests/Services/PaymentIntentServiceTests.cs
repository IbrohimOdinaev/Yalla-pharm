using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Yalla.Application.UnitTests.Services;

public sealed class PaymentIntentServiceTests
{
  [Fact]
  public async Task ConfirmBySuperAdmin_ShouldCreateOrderAndPaymentHistory()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Client", "911000001");
    var superAdmin = TestDbFactory.CreateUser("SuperAdmin", "911000002", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Ph-1", "Addr-1", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Med-1", "ART-1");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 10, price: 15m);

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.Add(offer);
    await db.SaveChangesAsync();

    var reservedOrderId = Guid.NewGuid();
    var intent = BuildPaymentIntent(
      reservedOrderId: reservedOrderId,
      client: client,
      pharmacyId: pharmacy.Id,
      medicineId: medicine.Id,
      price: 15m,
      quantity: 2,
      idempotencyKey: "intent-confirm-1");
    db.PaymentIntents.Add(intent);
    await db.SaveChangesAsync();

    var updatesPublisher = new RecordingRealtimeUpdatesPublisher();
    var service = CreateService(db, updatesPublisher);
    var response = await service.ConfirmBySuperAdminAsync(new ConfirmPaymentIntentBySuperAdminRequest
    {
      SuperAdminId = superAdmin.Id,
      PaymentIntentId = intent.Id
    });

    Assert.True(response.OrderCreated);
    Assert.Equal(PaymentIntentState.Confirmed, response.PaymentIntentState);

    var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == reservedOrderId);
    Assert.NotNull(order);
    Assert.Equal(OrderPaymentState.Confirmed, order!.PaymentState);

    var paymentHistory = await db.PaymentHistories.AsNoTracking().FirstOrDefaultAsync(x => x.OrderId == reservedOrderId);
    Assert.NotNull(paymentHistory);
    Assert.Equal(intent.Amount, paymentHistory!.Amount);

    var smsOutboxMessage = await db.SmsOutboxMessages.AsNoTracking().FirstOrDefaultAsync(x => x.OrderId == reservedOrderId);
    Assert.NotNull(smsOutboxMessage);
    Assert.Contains(intent.Amount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), smsOutboxMessage!.Message);
    Assert.Contains(
      updatesPublisher.Events,
      x => x.PaymentIntentId == intent.Id && x.State == PaymentIntentState.Confirmed && x.OrderId == reservedOrderId);
  }

  [Fact]
  public async Task ConfirmBySuperAdmin_WithInsufficientStock_ShouldSetNeedsResolution_AndNotCreateOrder()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Client2", "911000003");
    var superAdmin = TestDbFactory.CreateUser("SuperAdmin2", "911000004", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Ph-2", "Addr-2", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Med-2", "ART-2");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 1, price: 20m);

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.Add(offer);
    await db.SaveChangesAsync();

    var reservedOrderId = Guid.NewGuid();
    var intent = BuildPaymentIntent(
      reservedOrderId: reservedOrderId,
      client: client,
      pharmacyId: pharmacy.Id,
      medicineId: medicine.Id,
      price: 20m,
      quantity: 3,
      idempotencyKey: "intent-confirm-2");
    db.PaymentIntents.Add(intent);
    await db.SaveChangesAsync();

    var updatesPublisher = new RecordingRealtimeUpdatesPublisher();
    var service = CreateService(db, updatesPublisher);
    var response = await service.ConfirmBySuperAdminAsync(new ConfirmPaymentIntentBySuperAdminRequest
    {
      SuperAdminId = superAdmin.Id,
      PaymentIntentId = intent.Id
    });

    Assert.False(response.OrderCreated);
    Assert.Equal(PaymentIntentState.NeedsResolution, response.PaymentIntentState);
    Assert.False(await db.Orders.AsNoTracking().AnyAsync(x => x.Id == reservedOrderId));
    Assert.False(await db.PaymentHistories.AsNoTracking().AnyAsync(x => x.OrderId == reservedOrderId));
    Assert.Contains(
      updatesPublisher.Events,
      x => x.PaymentIntentId == intent.Id && x.State == PaymentIntentState.NeedsResolution && x.OrderId is null);
  }

  [Fact]
  public async Task RejectBySuperAdmin_ShouldNotCreateOrder()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Client3", "911000005");
    var superAdmin = TestDbFactory.CreateUser("SuperAdmin3", "911000006", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Ph-3", "Addr-3", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Med-3", "ART-3");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 5, price: 30m);

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.Add(offer);
    await db.SaveChangesAsync();

    var reservedOrderId = Guid.NewGuid();
    var intent = BuildPaymentIntent(
      reservedOrderId: reservedOrderId,
      client: client,
      pharmacyId: pharmacy.Id,
      medicineId: medicine.Id,
      price: 30m,
      quantity: 1,
      idempotencyKey: "intent-reject-1");
    db.PaymentIntents.Add(intent);
    await db.SaveChangesAsync();

    var updatesPublisher = new RecordingRealtimeUpdatesPublisher();
    var service = CreateService(db, updatesPublisher);
    var response = await service.RejectBySuperAdminAsync(new RejectPaymentIntentBySuperAdminRequest
    {
      SuperAdminId = superAdmin.Id,
      PaymentIntentId = intent.Id,
      Reason = "Payment not found"
    });

    Assert.Equal(PaymentIntentState.Rejected, response.PaymentIntentState);
    Assert.False(await db.Orders.AsNoTracking().AnyAsync(x => x.Id == reservedOrderId));
    Assert.Contains(
      updatesPublisher.Events,
      x => x.PaymentIntentId == intent.Id && x.State == PaymentIntentState.Rejected && x.OrderId is null);
  }

  private static PaymentIntent BuildPaymentIntent(
    Guid reservedOrderId,
    Client client,
    Guid pharmacyId,
    Guid medicineId,
    decimal price,
    int quantity,
    string idempotencyKey)
  {
    return new PaymentIntent(
      reservedOrderId: reservedOrderId,
      clientId: client.Id,
      clientPhoneNumber: client.PhoneNumber,
      pharmacyId: pharmacyId,
      isPickup: false,
      deliveryAddress: "Dushanbe",
      amount: price * quantity,
      currency: "TJS",
      paymentProvider: "DushanbeCityManualPhone",
      paymentReceiverAccount: "9762000087892609",
      paymentUrl: "http://pay.expresspay.tj/?A=9762000087892609&s=10&c=test",
      paymentComment: $"ClientNumber: {client.PhoneNumber} & OrderId: {reservedOrderId}",
      idempotencyKey: idempotencyKey,
      positions:
      [
        new PaymentIntentPosition(
          medicineId: medicineId,
          offerPharmacyId: pharmacyId,
          offerPrice: price,
          quantity: quantity)
      ],
      createdAtUtc: DateTime.UtcNow);
  }

  private static PaymentIntentService CreateService(
    AppDbContext db,
    IRealtimeUpdatesPublisher? realtimeUpdatesPublisher = null)
  {
    var smsTemplates = Options.Create(new SmsTemplatesOptions
    {
      Provider = "OsonSms",
      PaymentConfirmed = "Оплата подтверждена. Заказ {orderId} оформлен. Сумма: {amount} {currency}."
    });

    var orderStatusSmsService = new OrderStatusSmsService(smsTemplates);
    return new PaymentIntentService(
      db,
      realtimeUpdatesPublisher ?? new NoOpRealtimeUpdatesPublisher(),
      orderStatusSmsService,
      smsTemplates,
      NullLogger<PaymentIntentService>.Instance);
  }

  private sealed class RecordingRealtimeUpdatesPublisher : IRealtimeUpdatesPublisher
  {
    public List<(Guid PaymentIntentId, Guid ClientId, PaymentIntentState State, Guid? OrderId)> Events { get; } = [];

    public Task PublishPaymentIntentUpdatedAsync(
      Guid paymentIntentId,
      Guid clientId,
      PaymentIntentState state,
      Guid? orderId,
      CancellationToken cancellationToken = default)
    {
      Events.Add((paymentIntentId, clientId, state, orderId));
      return Task.CompletedTask;
    }

    public Task PublishOfferUpdatedAsync(Guid medicineId, Guid pharmacyId, decimal price, int stockQuantity, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task PublishOrderStatusChangedAsync(Guid orderId, string status, Guid? clientId, Guid pharmacyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task PublishBasketUpdatedAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task PublishPrescriptionUpdatedAsync(Guid prescriptionId, Guid clientId, Yalla.Domain.Enums.PrescriptionStatus status, Guid? assignedPharmacistId, CancellationToken cancellationToken = default) => Task.CompletedTask;
  }
}
