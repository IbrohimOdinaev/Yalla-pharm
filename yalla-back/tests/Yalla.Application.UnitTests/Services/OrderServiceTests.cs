using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.UnitTests.Services;

public class OrderServiceTests
{
  [Fact]
  public async Task GetClientOrderHistoryAsync_ExpiresTimedOutManualPaymentOrder()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = TestDbFactory.CreateOrder(
      setup.Client.Id,
      setup.Pharmacy.Id,
      "Address",
      (setup.Medicine, 10m, 2, false));

    order.MarkManualPaymentPending(
      amount: order.Cost,
      currency: "TJS",
      provider: "DushanbeCityManualPhone",
      receiverAccount: "9762000087892609",
      paymentUrl: "http://pay.expresspay.tj/?A=9762000087892609&s=20.00&c=test",
      paymentComment: "test",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(2));

    scope.Db.Orders.Add(order);

    var offer = await scope.Db.Offers
      .FirstAsync(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id);
    offer.SetStockQuantity(8);

    await scope.Db.SaveChangesAsync();

    scope.Db.Entry(order).Property(x => x.PaymentExpiresAtUtc).CurrentValue = DateTime.UtcNow.AddMinutes(-2);
    await scope.Db.SaveChangesAsync();
    scope.Db.ChangeTracker.Clear();

    var service = new OrderService(scope.Db);
    var response = await service.GetClientOrderHistoryAsync(new GetClientOrderHistoryRequest
    {
      ClientId = setup.Client.Id
    });

    var responseOrder = Assert.Single(response.Orders, x => x.OrderId == order.Id);
    Assert.Equal(Status.Cancelled, responseOrder.Status);
    Assert.Equal(OrderPaymentState.Expired, responseOrder.PaymentState);

    var storedOrder = await scope.Db.Orders
      .AsNoTracking()
      .FirstAsync(x => x.Id == order.Id);
    Assert.Equal(Status.Cancelled, storedOrder.Status);
    Assert.Equal(OrderPaymentState.Expired, storedOrder.PaymentState);

    var restoredOffer = await scope.Db.Offers
      .AsNoTracking()
      .FirstAsync(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id);
    Assert.Equal(10, restoredOffer.StockQuantity);

    var basketPosition = await scope.Db.BasketPositions
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.ClientId == setup.Client.Id && x.MedicineId == setup.Medicine.Id);
    Assert.NotNull(basketPosition);
    Assert.Equal(2, basketPosition!.Quantity);
  }

  [Fact]
  public async Task GetNewOrdersForWorkerAsync_ReturnsUnderReviewPreparingReady_OnlyOwnPharmacy()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var otherPharmacy = TestDbFactory.CreatePharmacy("Other", "Addr", Guid.NewGuid());
    scope.Db.Pharmacies.Add(otherPharmacy);
    await scope.Db.SaveChangesAsync();

    var underReview = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.UnderReview);
    var preparing = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Preparing);
    var ready = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Ready);
    _ = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.OnTheWay);
    _ = await CreateOrderWithStatus(scope, setup.Client.Id, otherPharmacy.Id, setup.Medicine, Status.UnderReview);

    var service = new OrderService(scope.Db);
    var response = await service.GetNewOrdersForWorkerAsync(new GetNewOrdersForWorkerRequest
    {
      WorkerId = setup.Worker.Id
    });

    Assert.Equal(3, response.Orders.Count);
    Assert.Contains(response.Orders, x => x.OrderId == underReview.Id);
    Assert.Contains(response.Orders, x => x.OrderId == preparing.Id);
    Assert.Contains(response.Orders, x => x.OrderId == ready.Id);
  }

  [Fact]
  public async Task StartOrderAssemblyAsync_MovesUnderReviewToPreparing()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.UnderReview);

    var service = new OrderService(scope.Db);
    var response = await service.StartOrderAssemblyAsync(new StartOrderAssemblyRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      AcceptedByAdminId = setup.StaffAdmin.Id
    });

    Assert.Equal(Status.Preparing, response.Status);
  }

  [Fact]
  public async Task StartOrderAssemblyAsync_MovesNewToPreparing()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.New);

    var service = new OrderService(scope.Db);
    var response = await service.StartOrderAssemblyAsync(new StartOrderAssemblyRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      AcceptedByAdminId = setup.StaffAdmin.Id
    });

    Assert.Equal(Status.Preparing, response.Status);
  }

  [Fact]
  public async Task StartOrderAssemblyAsync_ThrowsForWrongStatus()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Ready);

    var service = new OrderService(scope.Db);
    await Assert.ThrowsAsync<InvalidOperationException>(() => service.StartOrderAssemblyAsync(new StartOrderAssemblyRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id
    }));
  }

  [Fact]
  public async Task RejectOrderPositionsAsync_RecalculatesTotalsAndCreatesRefundStub()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var med2 = TestDbFactory.CreateMedicine("M2", "M-2");
    scope.Db.Medicines.Add(med2);
    scope.Db.Offers.Add(TestDbFactory.CreateOffer(med2.Id, setup.Pharmacy.Id, stock: 3, price: 20m));
    await scope.Db.SaveChangesAsync();

    var order = TestDbFactory.CreateOrder(
      setup.Client.Id,
      setup.Pharmacy.Id,
      "Addr",
      (setup.Medicine, 10m, 1, false),
      (med2, 20m, 2, false));
    order.NextStage(true);
    order.NextStage(true);
    scope.Db.Orders.Add(order);
    await scope.Db.SaveChangesAsync();

    var rejectPositionId = order.Positions.Last().Id;

    var service = new OrderService(scope.Db);
    var response = await service.RejectOrderPositionsAsync(new RejectOrderPositionsRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      PositionIds = [rejectPositionId]
    });

    var med2Offer = await scope.Db.Offers
      .AsNoTracking()
      .FirstAsync(x => x.MedicineId == med2.Id && x.PharmacyId == setup.Pharmacy.Id);

    Assert.Equal(40m, response.RefundRequest.Amount);
    Assert.Equal(10m, response.Order.Cost);
    Assert.Equal(40m, response.Order.ReturnCost);
    Assert.Contains(response.Order.Positions, x => x.PositionId == rejectPositionId && x.IsRejected);
    Assert.Equal(5, med2Offer.StockQuantity);
  }

  [Fact]
  public async Task RejectOrderPositionsAsync_AutoCancelsWhenAllRejected()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Preparing);
    var stockBefore = await scope.Db.Offers
      .AsNoTracking()
      .Where(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id)
      .Select(x => x.StockQuantity)
      .FirstAsync();

    var service = new OrderService(scope.Db);
    var response = await service.RejectOrderPositionsAsync(new RejectOrderPositionsRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      PositionIds = order.Positions.Select(x => x.Id).ToList()
    });

    Assert.Equal(Status.Cancelled, response.Order.Status);
    Assert.Equal(response.Order.ReturnCost, response.RefundRequest.Amount);

    var stockAfter = await scope.Db.Offers
      .AsNoTracking()
      .Where(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id)
      .Select(x => x.StockQuantity)
      .FirstAsync();
    Assert.Equal(stockBefore + 1, stockAfter);
  }

  [Fact]
  public async Task MarkOrderReadyAsync_MovesPreparingToReady()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Preparing);

    var service = new OrderService(scope.Db);
    var response = await service.MarkOrderReadyAsync(new MarkOrderReadyRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id
    });

    Assert.Equal(Status.Ready, response.Status);
  }

  [Fact]
  public async Task MarkOrderOnTheWayAsync_MovesReadyToOnTheWay()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Ready);

    var service = new OrderService(scope.Db);
    var response = await service.MarkOrderOnTheWayAsync(new MarkOrderOnTheWayRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id
    });

    Assert.Equal(Status.OnTheWay, response.Status);
  }

  [Fact]
  public async Task MarkOrderOnTheWayAsync_ForPickup_MovesReadyToPickedUp()
  {
    // Pickup orders skip the OnTheWay/Delivered transition entirely —
    // once the client collects the order at the pharmacy, the worker
    // marks it PickedUp directly from Ready. This used to map to
    // Delivered; the domain was tightened to distinguish the two
    // fulfilment paths (delivered-by-courier vs. picked-up-on-site).
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(
      scope,
      setup.Client.Id,
      setup.Pharmacy.Id,
      setup.Medicine,
      Status.Ready,
      isPickup: true);

    var service = new OrderService(scope.Db);
    var response = await service.MarkOrderOnTheWayAsync(new MarkOrderOnTheWayRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id
    });

    Assert.Equal(Status.PickedUp, response.Status);
  }

  [Fact]
  public async Task DispatchDeliveryAsync_CreatesJuraOrderAndMovesReadyToOnTheWay()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Ready);
    var deliveryData = new DeliveryData(
      order.Id,
      "Pharmacy",
      "Pharmacy address",
      38.5737,
      68.7738,
      "Client",
      "Client address",
      38.5598,
      68.7870);
    deliveryData.SetDeliveryCost(15m, 2.4);
    scope.Db.DeliveryData.Add(deliveryData);
    await scope.Db.SaveChangesAsync();

    var service = new OrderService(
      scope.Db,
      NullLogger<OrderService>.Instance,
      new NoOpRealtimeUpdatesPublisher(),
      new FakeJuraService());

    var response = await service.DispatchDeliveryAsync(new DispatchDeliveryRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      TariffId = 1
    });

    var saved = await scope.Db.Orders
      .Include(x => x.DeliveryData)
      .AsNoTracking()
      .FirstAsync(x => x.Id == order.Id);

    Assert.False(response.AlreadyDispatched);
    Assert.Equal(123456, response.JuraOrderId);
    Assert.Equal(Status.OnTheWay, saved.Status);
    Assert.Equal(123456, saved.DeliveryData?.JuraOrderId);
  }

  [Fact]
  public async Task DispatchDeliveryAsync_WhenAlreadyDispatched_ReturnsExistingJuraOrderWithoutCallingJura()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.OnTheWay);
    var deliveryData = new DeliveryData(
      order.Id,
      "Pharmacy",
      "Pharmacy address",
      38.5737,
      68.7738,
      "Client",
      "Client address",
      38.5598,
      68.7870);
    deliveryData.SetDeliveryCost(15m, 2.4);
    deliveryData.SetJuraOrder(654321, "created", 1);
    scope.Db.DeliveryData.Add(deliveryData);
    await scope.Db.SaveChangesAsync();

    var jura = new FakeJuraService();
    var service = new OrderService(
      scope.Db,
      NullLogger<OrderService>.Instance,
      new NoOpRealtimeUpdatesPublisher(),
      jura);

    var response = await service.DispatchDeliveryAsync(new DispatchDeliveryRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      TariffId = 1
    });

    Assert.True(response.AlreadyDispatched);
    Assert.Equal(654321, response.JuraOrderId);
    Assert.Equal(0, jura.CreateOrderCalls);
  }

  [Fact]
  public async Task DispatchDeliveryAsync_WhenClientPhoneIsMissing_UsesJuraFallbackPhone()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var orderId = Guid.NewGuid();
    var orderPosition = new OrderPosition(
      orderId,
      setup.Medicine.Id,
      setup.Medicine,
      new OfferSnapshot(setup.Pharmacy.Id, 10m),
      quantity: 1);
    var order = new Order(
      orderId,
      setup.Client.Id,
      clientPhoneNumber: "",
      pharmacyId: setup.Pharmacy.Id,
      deliveryAddress: "Address",
      positions: [orderPosition]);

    while (order.Status != Status.Ready)
      order.NextStage(true);

    var deliveryData = new DeliveryData(
      order.Id,
      "Pharmacy",
      "Pharmacy address",
      38.5737,
      68.7738,
      "Client",
      "Client address",
      38.5598,
      68.7870);
    deliveryData.SetDeliveryCost(15m, 2.4);
    scope.Db.Orders.Add(order);
    scope.Db.Entry(order).Property(x => x.PublicId).CurrentValue = 53;
    scope.Db.DeliveryData.Add(deliveryData);
    await scope.Db.SaveChangesAsync();

    var jura = new FakeJuraService();
    var service = new OrderService(
      scope.Db,
      NullLogger<OrderService>.Instance,
      new NoOpRealtimeUpdatesPublisher(),
      jura);

    await service.DispatchDeliveryAsync(new DispatchDeliveryRequest
    {
      WorkerId = setup.Worker.Id,
      OrderId = order.Id,
      TariffId = 1
    });

    Assert.Equal("000000000", jura.LastClientPhone);
  }

  [Fact]
  public async Task MoveOrderToNextStatusBySuperAdminAsync_MovesNewToUnderReview()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var superAdmin = TestDbFactory.CreateUser("S", "992400009", Role.SuperAdmin);
    scope.Db.Users.Add(superAdmin);
    await scope.Db.SaveChangesAsync();

    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.New);

    var service = new OrderService(scope.Db);
    var response = await service.MoveOrderToNextStatusBySuperAdminAsync(new MarkOrderDeliveredBySuperAdminRequest
    {
      SuperAdminId = superAdmin.Id,
      OrderId = order.Id
    });

    Assert.Equal(Status.UnderReview, response.Status);
  }

  [Fact]
  public async Task MarkOrderDeliveredBySuperAdminAsync_MovesOnTheWayToDelivered()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var superAdmin = TestDbFactory.CreateUser("S", "992400010", Role.SuperAdmin);
    scope.Db.Users.Add(superAdmin);
    await scope.Db.SaveChangesAsync();

    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.OnTheWay);

    var service = new OrderService(scope.Db);
    var response = await service.MarkOrderDeliveredBySuperAdminAsync(new MarkOrderDeliveredBySuperAdminRequest
    {
      SuperAdminId = superAdmin.Id,
      OrderId = order.Id
    });

    Assert.Equal(Status.Delivered, response.Status);
  }

  [Fact]
  public async Task MarkOrderDeliveredBySuperAdminAsync_ThrowsForNonSuperAdmin()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var admin = TestDbFactory.CreateUser("A", "992400011", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.OnTheWay);

    var service = new OrderService(scope.Db);
    await Assert.ThrowsAsync<InvalidOperationException>(() =>
      service.MarkOrderDeliveredBySuperAdminAsync(new MarkOrderDeliveredBySuperAdminRequest
      {
        SuperAdminId = admin.Id,
        OrderId = order.Id
      }));
  }

  [Fact]
  public async Task DeleteNewOrderByAdminAsync_RemovesOrderAndRestoresStock()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.New);

    var offer = await scope.Db.Offers
      .AsTracking()
      .FirstAsync(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id);

    var reservedQuantity = order.Positions
      .Where(x => !x.IsRejected)
      .Sum(x => x.Quantity);

    offer.SetStockQuantity(offer.StockQuantity - reservedQuantity);
    await scope.Db.SaveChangesAsync();
    var stockAfterReservation = offer.StockQuantity;

    var service = new OrderService(scope.Db);
    var response = await service.DeleteNewOrderByAdminAsync(new DeleteNewOrderByAdminRequest
    {
      WorkerId = setup.Worker.Id,
      PharmacyId = setup.Pharmacy.Id,
      OrderId = order.Id
    });

    Assert.True(response.IsDeleted);
    Assert.False(await scope.Db.Orders.AsNoTracking().AnyAsync(x => x.Id == order.Id));

    var stockAfterDelete = await scope.Db.Offers
      .AsNoTracking()
      .Where(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id)
      .Select(x => x.StockQuantity)
      .FirstAsync();

    Assert.Equal(stockAfterReservation + reservedQuantity, stockAfterDelete);
  }

  [Fact]
  public async Task CancelOrderAsync_ClientCanCancelOnTheWay()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.OnTheWay);
    var stockBefore = await scope.Db.Offers
      .AsNoTracking()
      .Where(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id)
      .Select(x => x.StockQuantity)
      .FirstAsync();

    var service = new OrderService(scope.Db);
    var response = await service.CancelOrderAsync(new CancelOrderRequest
    {
      ClientId = setup.Client.Id,
      OrderId = order.Id
    });

    Assert.Equal(Status.Cancelled, response.Status);
    Assert.Equal(order.Cost, response.RefundRequest.Amount);

    var stockAfter = await scope.Db.Offers
      .AsNoTracking()
      .Where(x => x.PharmacyId == setup.Pharmacy.Id && x.MedicineId == setup.Medicine.Id)
      .Select(x => x.StockQuantity)
      .FirstAsync();
    Assert.Equal(stockBefore + 1, stockAfter);
  }

  [Fact]
  public async Task CancelOrderAsync_ThrowsWhenDelivered()
  {
    using var scope = TestDbFactory.Create();
    var setup = await SeedWorkerSetup(scope);
    var order = await CreateOrderWithStatus(scope, setup.Client.Id, setup.Pharmacy.Id, setup.Medicine, Status.Delivered);

    var service = new OrderService(scope.Db);

    await Assert.ThrowsAsync<Yalla.Domain.Exceptions.DomainException>(() =>
      service.CancelOrderAsync(new CancelOrderRequest
      {
        ClientId = setup.Client.Id,
        OrderId = order.Id
      }));
  }

  private static async Task<(Client Client, Pharmacy Pharmacy, PharmacyWorker Worker, PharmacyWorker StaffAdmin, Medicine Medicine)> SeedWorkerSetup(TestDbScope scope)
  {
    var client = TestDbFactory.CreateClient("Client", "992400002");
    scope.Db.Clients.Add(client);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("Ph", "Addr", Guid.NewGuid());
    var worker = TestDbFactory.CreateWorker("Pharmacy Account", "992400003", pharmacy.Id, pharmacy, Role.PharmacyAccount);
    var staffAdmin = TestDbFactory.CreateWorker("Admin", "992400004", pharmacy.Id, pharmacy);
    pharmacy.SetAdminId(worker.Id);
    var medicine = TestDbFactory.CreateMedicine("M", "M-1");

    scope.Db.Pharmacies.Add(pharmacy);
    scope.Db.PharmacyWorkers.AddRange(worker, staffAdmin);
    scope.Db.Medicines.Add(medicine);
    scope.Db.Offers.Add(TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 10, price: 10m));
    await scope.Db.SaveChangesAsync();

    return (client, pharmacy, worker, staffAdmin, medicine);
  }

  private static async Task<Order> CreateOrderWithStatus(
    TestDbScope scope,
    Guid clientId,
    Guid pharmacyId,
    Medicine medicine,
    Status status,
    bool isPickup = false)
  {
    var order = TestDbFactory.CreateOrder(clientId, pharmacyId, "Address", isPickup, (medicine, 10m, 1, false));

    while (order.Status != status)
    {
      order.NextStage(true);
      if ((int)order.Status > (int)status)
        throw new InvalidOperationException("Cannot reach requested status with NextStage.");
    }

    if (status is not (Status.New or Status.UnderReview))
    {
      var acceptedAdminId = await scope.Db.PharmacyWorkers
        .AsNoTracking()
        .Where(x => x.PharmacyId == pharmacyId && x.Role == Role.Admin)
        .Select(x => x.Id)
        .FirstOrDefaultAsync();
      if (acceptedAdminId != Guid.Empty)
        order.AssignAcceptedAdmin(acceptedAdminId);
    }

    scope.Db.Orders.Add(order);
    await scope.Db.SaveChangesAsync();
    return order;
  }

  private sealed class FakeJuraService : IJuraService
  {
    public int CreateOrderCalls { get; private set; }
    public string? LastClientPhone { get; private set; }

    public Task<List<JuraAddressSuggestion>> SearchAddressAsync(string text, CancellationToken ct)
    {
      return Task.FromResult(new List<JuraAddressSuggestion>());
    }

    public Task<JuraCalculateResult> CalculateDeliveryAsync(
      JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct, bool deliverToDoor = false)
    {
      return Task.FromResult(new JuraCalculateResult { Amount = 15m, Distance = 2.4 });
    }

    public Task<JuraCreateOrderResult> CreateDeliveryOrderAsync(
      JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct, bool deliverToDoor = false)
    {
      CreateOrderCalls++;
      LastClientPhone = clientPhone;
      return Task.FromResult(new JuraCreateOrderResult
      {
        OrderId = 123456,
        Status = "created",
        StatusId = 1,
        PerformerDeviceId = 987,
        PerformerFirstName = "Driver",
        PerformerLastName = "One",
        PerformerPhone = "992900000000",
        RecipientCode = "1234"
      });
    }

    public Task<JuraOrderStatusResult> GetOrderStatusAsync(long juraOrderId, CancellationToken ct)
    {
      return Task.FromResult(new JuraOrderStatusResult { OrderId = juraOrderId, Status = "created", StatusId = 1 });
    }

    public Task<JuraDriverPositionResult> GetDriverPositionAsync(long deviceId, CancellationToken ct)
    {
      return Task.FromResult(new JuraDriverPositionResult { DeviceId = deviceId, Lat = 38.57, Lng = 68.77 });
    }

    public Task CancelOrderAsync(long juraOrderId, string reason, CancellationToken ct)
    {
      return Task.CompletedTask;
    }

    public Task<List<JuraTariff>> GetTariffsAsync(CancellationToken ct)
    {
      return Task.FromResult(new List<JuraTariff>());
    }

    public Task<string?> GetReceiptCodeAsync(long juraOrderId, CancellationToken ct)
    {
      return Task.FromResult<string?>("1234");
    }
  }
}
