using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
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

  private static ClientService CreateService(TestDbScope scope)
  {
    var logger = LoggerFactory.Create(_ => { }).CreateLogger<ClientService>();
    return new ClientService(
      scope.Db,
      new StubPaymentService(
        Options.Create(new DushanbeCityPaymentOptions()),
        new FakePaymentSettingsService()),
      new BCryptPasswordHasher(),
      new FakeSmsService(),
      Options.Create(new SmsVerificationOptions
      {
        RegistrationEnabled = true,
        AllowRegistrationBypass = true
      }),
      Options.Create(new DushanbeCityPaymentOptions()),
      logger,
      new NoOpRealtimeUpdatesPublisher(),
      new FakeClientAddressService());
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
