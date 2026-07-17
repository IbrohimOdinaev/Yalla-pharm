using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public sealed class ClientServiceCheckoutTests
{
  [Fact]
  public async Task PreviewCheckoutAsync_HandlesDuplicateOffersForSameMedicine()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    await db.Database.ExecuteSqlRawAsync("DROP INDEX IF EXISTS ux_offers_medicine_id_pharmacy_id;");

    var client = TestDbFactory.CreateClient("Client", "900400001");
    var admin = TestDbFactory.CreateUser("Admin", "900400002", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-1", "Pickup address", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Medicine", "ART-CHECKOUT-1");
    var lowStockOffer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 1, price: 5m);
    var enoughStockOffer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 10, price: 8m);

    db.Users.Add(admin);
    db.Clients.Add(client);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.AddRange(lowStockOffer, enoughStockOffer);
    await db.SaveChangesAsync();

    var service = CreateService(scope);
    var response = await service.PreviewCheckoutAsync(new CheckoutBasketRequest
    {
      ClientId = client.Id,
      PharmacyId = pharmacy.Id,
      IsPickup = true,
      Source = new CheckoutSourceRequest
      {
        Kind = CheckoutSourceKind.Explicit,
        Positions =
        [
          new CheckoutPositionDraftRequest
          {
            MedicineId = medicine.Id,
            Quantity = 2
          }
        ]
      }
    });

    Assert.True(response.CanCheckout);
    Assert.Equal(1, response.AcceptedPositionsCount);
    Assert.Equal(16m, response.Cost);
    var position = Assert.Single(response.Positions);
    Assert.False(position.IsRejected);
    Assert.Equal(10, position.FoundQuantity);
    Assert.Equal(8m, position.Price);
  }

  [Fact]
  public async Task PreviewCheckoutAsync_HandlesDuplicateUnitOverridesForSameLookupRequest()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    await db.Database.ExecuteSqlRawAsync("DROP INDEX IF EXISTS ix_prescription_checklist_items_lookup_request_id;");

    var client = TestDbFactory.CreateClient("Client", "900400003");
    var admin = TestDbFactory.CreateUser("Admin", "900400004", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-2", "Pickup address", admin.Id);
    var lookupRequestId = Guid.NewGuid();
    var shadowMedicine = Medicine.ForManualLookup(
      "Manual medicine",
      $"manual-{Guid.NewGuid():N}",
      lookupRequestId,
      Guid.NewGuid());
    var prescription = new Prescription(
      client.Id,
      patientAge: 30,
      clientComment: null,
      images: [new PrescriptionImage("rx-key", 0)]);
    typeof(Prescription)
      .GetProperty(nameof(Prescription.PublicId))!
      .SetValue(prescription, 4001);
    prescription.MoveToAwaitingConfirmation();
    prescription.MoveToQueue();
    prescription.TakeIntoReview(admin.Id);

    var lowOverride = PrescriptionChecklistItem.Manual("Manual low", 1, null);
    lowOverride.AttachLookupRequest(lookupRequestId);
    lowOverride.SetUnitOverride(1, 10m);
    var highOverride = PrescriptionChecklistItem.Manual("Manual high", 1, null);
    highOverride.AttachLookupRequest(lookupRequestId);
    highOverride.SetUnitOverride(2, 25m);
    prescription.SubmitChecklist(null, [lowOverride, highOverride]);

    db.Users.Add(admin);
    db.Clients.Add(client);
    db.Pharmacies.Add(pharmacy);
    db.Prescriptions.Add(prescription);
    db.Medicines.Add(shadowMedicine);
    db.Offers.Add(TestDbFactory.CreateOffer(shadowMedicine.Id, pharmacy.Id, stock: 3, price: 8m));
    await db.SaveChangesAsync();

    var service = CreateService(scope);
    var response = await service.PreviewCheckoutAsync(new CheckoutBasketRequest
    {
      ClientId = client.Id,
      PharmacyId = pharmacy.Id,
      IsPickup = true,
      Source = new CheckoutSourceRequest
      {
        Kind = CheckoutSourceKind.Explicit,
        PrescriptionId = prescription.Id,
        Positions =
        [
          new CheckoutPositionDraftRequest
          {
            MedicineId = shadowMedicine.Id,
            Quantity = 1
          }
        ]
      }
    });

    Assert.True(response.CanCheckout);
    Assert.Equal(25m, response.Cost);
    var position = Assert.Single(response.Positions);
    Assert.True(position.UseUnitMode);
    Assert.Equal(2, position.UnitCount);
    Assert.Equal(25m, position.UnitTotalPrice);
  }

  [Fact]
  public async Task CheckoutBasketAsync_AllowsUnitModePaymentIntentWhenOfferPriceIsZero()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Client", "900400005");
    var admin = TestDbFactory.CreateUser("Admin", "900400006", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-3", "Pickup address", admin.Id);
    var lookupRequestId = Guid.NewGuid();
    var shadowMedicine = Medicine.ForManualLookup(
      "Manual medicine",
      $"manual-{Guid.NewGuid():N}",
      lookupRequestId,
      Guid.NewGuid());
    var prescription = new Prescription(
      client.Id,
      patientAge: 30,
      clientComment: null,
      images: [new PrescriptionImage("rx-key", 0)]);
    typeof(Prescription)
      .GetProperty(nameof(Prescription.PublicId))!
      .SetValue(prescription, 4002);
    prescription.MoveToAwaitingConfirmation();
    prescription.MoveToQueue();
    prescription.TakeIntoReview(admin.Id);

    var item = PrescriptionChecklistItem.Manual("Manual", 1, null);
    item.AttachLookupRequest(lookupRequestId);
    item.SetUnitOverride(2, 25m);
    prescription.SubmitChecklist(null, [item]);

    db.Users.Add(admin);
    db.Clients.Add(client);
    db.Pharmacies.Add(pharmacy);
    db.Prescriptions.Add(prescription);
    db.Medicines.Add(shadowMedicine);
    db.Offers.Add(TestDbFactory.CreateOffer(shadowMedicine.Id, pharmacy.Id, stock: 3, price: 0m));
    await db.SaveChangesAsync();

    var service = CreateService(scope);
    var response = await service.CheckoutBasketAsync(new CheckoutBasketRequest
    {
      ClientId = client.Id,
      PharmacyId = pharmacy.Id,
      IsPickup = true,
      IdempotencyKey = $"test-{Guid.NewGuid():N}",
      Source = new CheckoutSourceRequest
      {
        Kind = CheckoutSourceKind.Explicit,
        PrescriptionId = prescription.Id,
        Positions =
        [
          new CheckoutPositionDraftRequest
          {
            MedicineId = shadowMedicine.Id,
            Quantity = 1
          }
        ]
      }
    });

    Assert.Equal(25m, response.Cost);
    var intent = await db.PaymentIntents
      .AsNoTracking()
      .Include(x => x.Positions)
      .SingleAsync(x => x.ReservedOrderId == response.ReservedOrderId);
    var position = Assert.Single(intent.Positions);
    Assert.Equal(25m, position.OfferPrice);
  }

  [Fact]
  public async Task CheckoutBasketAsync_WithExplicitDeliveryTelegramClientAndNoPaymentReceiver_ShouldCreatePaymentIntent()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = new Client("Telegram Client", 6272785076, "v7regx");
    var admin = TestDbFactory.CreateUser("Admin", "900400008", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-4", "Delivery pharmacy address", admin.Id);
    pharmacy.SetCoordinates(38.573255, 68.786378);
    var selectedMedicine = TestDbFactory.CreateMedicine("Selected medicine", "ART-CHECKOUT-4");
    var unselectedMedicine = TestDbFactory.CreateMedicine("Unselected medicine", "ART-CHECKOUT-5");
    var selectedOffer = TestDbFactory.CreateOffer(selectedMedicine.Id, pharmacy.Id, stock: 10, price: 32m);

    client.AddBasketPosition(new BasketPosition(client.Id, selectedMedicine.Id, selectedMedicine, 1));
    client.AddBasketPosition(new BasketPosition(client.Id, unselectedMedicine.Id, unselectedMedicine, 1));

    db.Users.Add(admin);
    db.Clients.Add(client);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.AddRange(selectedMedicine, unselectedMedicine);
    db.Offers.Add(selectedOffer);
    await db.SaveChangesAsync();

    var service = CreateService(
      scope,
      paymentBaseUrl: string.Empty,
      juraService: new FakeJuraService());
    var response = await service.CheckoutBasketAsync(new CheckoutBasketRequest
    {
      ClientId = client.Id,
      PharmacyId = pharmacy.Id,
      IsPickup = false,
      DeliveryAddress = "Душанбе, район Фирдавси",
      DeliveryAddressTitle = "Душанбе, район Фирдавси",
      DeliveryLatitude = 38.5598,
      DeliveryLongitude = 68.7870,
      IdempotencyKey = $"test-{Guid.NewGuid():N}",
      Source = new CheckoutSourceRequest
      {
        Kind = CheckoutSourceKind.Explicit,
        ConsumeFromBasket = true,
        Positions =
        [
          new CheckoutPositionDraftRequest
          {
            MedicineId = selectedMedicine.Id,
            Quantity = 1
          }
        ]
      }
    });

    Assert.Equal(32m, response.Cost);
    Assert.Equal(5m, response.DeliveryCost);
    Assert.Equal(OrderPaymentState.PendingManualConfirmation, response.PaymentState);
    Assert.NotEqual(Guid.Empty, response.PaymentIntentId);

    var intent = await db.PaymentIntents.AsNoTracking().SingleAsync(x => x.Id == response.PaymentIntentId);
    Assert.Equal(string.Empty, intent.ClientPhoneNumber);
    Assert.Equal(string.Empty, intent.PaymentReceiverAccount);

    var order = await db.Orders.AsNoTracking().SingleAsync(x => x.Id == response.ReservedOrderId);
    Assert.Equal(string.Empty, order.ClientPhoneNumber);
    Assert.Equal(string.Empty, order.PaymentReceiverAccount);
    Assert.False(await db.BasketPositions.AsNoTracking().AnyAsync(x => x.ClientId == client.Id && x.MedicineId == selectedMedicine.Id));
    Assert.True(await db.BasketPositions.AsNoTracking().AnyAsync(x => x.ClientId == client.Id && x.MedicineId == unselectedMedicine.Id));
  }

  [Fact]
  public async Task CheckoutBasketAsync_WithMixedPositiveAndZeroPriceExplicitPositions_ShouldCreatePaymentIntent()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Client", "900400009");
    var admin = TestDbFactory.CreateUser("Admin", "900400010", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-5", "Pickup address", admin.Id);
    var paidMedicine = TestDbFactory.CreateMedicine("Paid medicine", "ART-CHECKOUT-6");
    var zeroPriceMedicine = TestDbFactory.CreateMedicine("Zero price medicine", "ART-CHECKOUT-7");

    db.Users.Add(admin);
    db.Clients.Add(client);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.AddRange(paidMedicine, zeroPriceMedicine);
    db.Offers.AddRange(
      TestDbFactory.CreateOffer(paidMedicine.Id, pharmacy.Id, stock: 10, price: 32m),
      TestDbFactory.CreateOffer(zeroPriceMedicine.Id, pharmacy.Id, stock: 10, price: 0m));
    await db.SaveChangesAsync();

    var service = CreateService(scope);
    var response = await service.CheckoutBasketAsync(new CheckoutBasketRequest
    {
      ClientId = client.Id,
      PharmacyId = pharmacy.Id,
      IsPickup = true,
      IdempotencyKey = $"test-{Guid.NewGuid():N}",
      Source = new CheckoutSourceRequest
      {
        Kind = CheckoutSourceKind.Explicit,
        Positions =
        [
          new CheckoutPositionDraftRequest
          {
            MedicineId = paidMedicine.Id,
            Quantity = 1
          },
          new CheckoutPositionDraftRequest
          {
            MedicineId = zeroPriceMedicine.Id,
            Quantity = 1
          }
        ]
      }
    });

    Assert.Equal(32m, response.Cost);

    var intent = await db.PaymentIntents
      .AsNoTracking()
      .Include(x => x.Positions)
      .SingleAsync(x => x.ReservedOrderId == response.ReservedOrderId);

    Assert.Contains(intent.Positions, x => x.MedicineId == paidMedicine.Id && x.OfferPrice == 32m);
    Assert.Contains(intent.Positions, x => x.MedicineId == zeroPriceMedicine.Id && x.OfferPrice == 0m);
  }

  private static ClientService CreateService(
    TestDbScope scope,
    string? paymentBaseUrl = null,
    IJuraService? juraService = null)
  {
    var logger = LoggerFactory.Create(_ => { }).CreateLogger<ClientService>();
    var paymentOptions = new DushanbeCityPaymentOptions();
    if (paymentBaseUrl is not null)
      paymentOptions.BaseUrl = paymentBaseUrl;

    return new ClientService(
      scope.Db,
      new StubPaymentService(
        Options.Create(paymentOptions),
        new FakePaymentSettingsService(paymentBaseUrl)),
      new BCryptPasswordHasher(),
      new FakeSmsService(),
      Options.Create(new SmsVerificationOptions
      {
        RegistrationEnabled = true,
        AllowRegistrationBypass = true
      }),
      Options.Create(paymentOptions),
      logger,
      new NoOpRealtimeUpdatesPublisher(),
      new FakeClientAddressService(),
      juraService);
  }

  private sealed class FakeJuraService : IJuraService
  {
    public Task<List<JuraAddressSuggestion>> SearchAddressAsync(string text, CancellationToken ct) => Task.FromResult<List<JuraAddressSuggestion>>([]);
    public Task<JuraCalculateResult> CalculateDeliveryAsync(
      JuraAddress from,
      JuraAddress to,
      int? tariffId,
      string? clientPhone,
      CancellationToken ct,
      bool deliverToDoor = false)
    {
      return Task.FromResult(new JuraCalculateResult
      {
        Amount = 5m,
        Distance = 2.5
      });
    }
    public Task<JuraCreateOrderResult> CreateDeliveryOrderAsync(JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct, bool deliverToDoor = false) => throw new NotSupportedException();
    public Task<JuraOrderStatusResult> GetOrderStatusAsync(long juraOrderId, CancellationToken ct) => throw new NotSupportedException();
    public Task<JuraDriverPositionResult> GetDriverPositionAsync(long deviceId, CancellationToken ct) => throw new NotSupportedException();
    public Task<List<JuraTariff>> GetTariffsAsync(CancellationToken ct) => Task.FromResult<List<JuraTariff>>([]);
    public Task<List<JuraCity>> GetCitiesAsync(CancellationToken ct) => Task.FromResult<List<JuraCity>>([]);
    public Task<List<JuraActiveOrder>> GetActiveOrdersAsync(string clientPhone, CancellationToken ct) => Task.FromResult<List<JuraActiveOrder>>([]);
    public Task<List<JuraPayType>> GetPayTypesAsync(CancellationToken ct) => Task.FromResult<List<JuraPayType>>([]);
    public Task<List<JuraAllowance>> GetAllowancesAsync(int? tariffId, CancellationToken ct) => Task.FromResult<List<JuraAllowance>>([]);
    public Task CancelOrderAsync(long juraOrderId, string reason, CancellationToken ct) => Task.CompletedTask;
    public Task<string?> GetReceiptCodeAsync(long juraOrderId, CancellationToken ct) => Task.FromResult<string?>(null);
  }

  private sealed class FakeSmsService : ISmsService
  {
    public Task<SmsSendResponse> SendSmsAsync(SmsSendRequest request, CancellationToken cancellationToken = default)
      => Task.FromResult(new SmsSendResponse());

    public Task<SmsSendResponse> ResendSmsAsync(SmsResendRequest request, CancellationToken cancellationToken = default)
      => Task.FromResult(new SmsSendResponse());

    public Task<SmsVerifyResponse> VerifySmsAsync(SmsVerifyRequest request, CancellationToken cancellationToken = default)
      => Task.FromResult(new SmsVerifyResponse
      {
        IsSuccess = true,
        FailureReason = SmsVerificationFailureReason.None,
        SessionId = request.SessionId,
        Purpose = SmsVerificationPurpose.ClientRegistration,
        PhoneNumber = "900000000",
        PayloadJson = """{"name":"Client","phoneNumber":"900000000","passwordHash":"hash"}"""
      });
  }
}
