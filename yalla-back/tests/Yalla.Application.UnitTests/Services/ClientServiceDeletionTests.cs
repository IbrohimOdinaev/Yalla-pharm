using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.UnitTests.Services;

public sealed class ClientServiceDeletionTests
{
  [Fact]
  public async Task DeleteClientAsync_WithOrders_ShouldDeleteClientAndPreserveOrderHistory()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Delete Me", "900300001");
    var admin = TestDbFactory.CreateUser("Admin", "900300002", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("P-1", "Addr-1", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Medicine", "ART-DELETE-1");

    db.Users.Add(admin);
    db.Pharmacies.Add(pharmacy);
    db.Clients.Add(client);
    db.Medicines.Add(medicine);
    await db.SaveChangesAsync();

    var orderId = Guid.NewGuid();
    var order = new Order(
      orderId,
      client.Id,
      client.PhoneNumber,
      pharmacy.Id,
      "Dushanbe",
      [
        new OrderPosition(
          orderId,
          medicine.Id,
          medicine,
          new OfferSnapshot(pharmacy.Id, 12m),
          1)
      ],
      isPickup: false);

    var basketPosition = new BasketPosition(client.Id, medicine.Id, medicine, 2);
    db.Orders.Add(order);
    db.BasketPositions.Add(basketPosition);
    await db.SaveChangesAsync();

    var service = CreateService(scope);
    var response = await service.DeleteClientAsync(new DeleteClientRequest
    {
      ClientId = client.Id
    });

    Assert.Equal(client.Id, response.DeletedClientId);
    Assert.False(await db.Clients.AsNoTracking().AnyAsync(x => x.Id == client.Id));
    Assert.False(await db.BasketPositions.AsNoTracking().AnyAsync(x => x.ClientId == client.Id));

    var orderFromDb = await db.Orders
      .AsNoTracking()
      .FirstAsync(x => x.Id == orderId);

    Assert.Null(orderFromDb.ClientId);
    Assert.Equal(client.PhoneNumber, orderFromDb.ClientPhoneNumber);
  }

  [Fact]
  public async Task DeleteClientAsync_WithoutOrders_ShouldDeleteClient()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var client = TestDbFactory.CreateClient("Delete Empty", "900300003");
    db.Clients.Add(client);
    await db.SaveChangesAsync();

    var service = CreateService(scope);
    var response = await service.DeleteClientAsync(new DeleteClientRequest
    {
      ClientId = client.Id
    });

    Assert.Equal(client.Id, response.DeletedClientId);
    Assert.False(await db.Clients.AsNoTracking().AnyAsync(x => x.Id == client.Id));
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
