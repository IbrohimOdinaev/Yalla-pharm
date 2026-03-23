using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Yalla.Api.IntegrationTests.TestInfrastructure;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class PaymentIntentsIntegrationTests : ApiTestBase
{
  public PaymentIntentsIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public async Task Checkout_WithPaymentIntent_ThenConfirm_ShouldCreateOrderAndPaymentHistory()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);
    using var superAdminActor = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, intent flow",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);

    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var paymentIntentId = checkoutPayload.GetProperty("paymentIntentId").GetGuid();
    var reservedOrderId = checkoutPayload.GetProperty("reservedOrderId").GetGuid();
    Assert.Equal((int)Status.New, checkoutPayload.GetProperty("status").GetInt32());
    Assert.Equal((int)OrderPaymentState.PendingManualConfirmation, checkoutPayload.GetProperty("paymentState").GetInt32());

    var clientIntentResponse = await clientActor.GetAsync($"/api/clients/payment-intents/{paymentIntentId}");
    Assert.Equal(HttpStatusCode.OK, clientIntentResponse.StatusCode);
    var clientIntentPayload = await ReadJsonAsync(clientIntentResponse);
    Assert.Equal((int)PaymentIntentState.AwaitingAdminConfirmation, clientIntentPayload.GetProperty("paymentIntent").GetProperty("state").GetInt32());
    Assert.Equal(JsonValueKind.Null, clientIntentPayload.GetProperty("orderId").ValueKind);

    var confirmResponse = await superAdminActor.PostAsync(
      $"/api/superadmin/payment-intents/{paymentIntentId}/confirm",
      JsonContent.Create(new { }));
    Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

    var confirmPayload = await ReadJsonAsync(confirmResponse);
    Assert.True(confirmPayload.GetProperty("orderCreated").GetBoolean());
    Assert.Equal((int)PaymentIntentState.Confirmed, confirmPayload.GetProperty("paymentIntentState").GetInt32());

    var clientIntentAfterConfirmResponse = await clientActor.GetAsync($"/api/clients/payment-intents/{paymentIntentId}");
    Assert.Equal(HttpStatusCode.OK, clientIntentAfterConfirmResponse.StatusCode);
    var clientIntentAfterConfirmPayload = await ReadJsonAsync(clientIntentAfterConfirmResponse);
    Assert.Equal((int)PaymentIntentState.Confirmed, clientIntentAfterConfirmPayload.GetProperty("paymentIntent").GetProperty("state").GetInt32());
    Assert.Equal(reservedOrderId, clientIntentAfterConfirmPayload.GetProperty("orderId").GetGuid());

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    Assert.True(await dbContext.Orders.AsNoTracking().AnyAsync(x => x.Id == reservedOrderId));
    Assert.True(await dbContext.PaymentHistories.AsNoTracking().AnyAsync(x => x.OrderId == reservedOrderId));
    var smsOutboxMessage = await dbContext.SmsOutboxMessages
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.OrderId == reservedOrderId);
    Assert.NotNull(smsOutboxMessage);
    Assert.Contains(checkoutPayload.GetProperty("cost").GetDecimal().ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), smsOutboxMessage!.Message);
  }

  [Fact]
  public async Task ConfirmPaymentIntent_RepeatedCall_ShouldNotCreateDuplicateOrder()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);
    using var superAdminActor = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, double confirm",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);
    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var paymentIntentId = checkoutPayload.GetProperty("paymentIntentId").GetGuid();
    var reservedOrderId = checkoutPayload.GetProperty("reservedOrderId").GetGuid();

    var confirmResponse1 = await superAdminActor.PostAsync(
      $"/api/superadmin/payment-intents/{paymentIntentId}/confirm",
      JsonContent.Create(new { }));
    var confirmResponse2 = await superAdminActor.PostAsync(
      $"/api/superadmin/payment-intents/{paymentIntentId}/confirm",
      JsonContent.Create(new { }));

    var firstBody = await confirmResponse1.Content.ReadAsStringAsync();
    var secondBody = await confirmResponse2.Content.ReadAsStringAsync();
    Assert.True(
      confirmResponse1.StatusCode == HttpStatusCode.OK,
      $"First confirm failed. Status={(int)confirmResponse1.StatusCode}. Body={firstBody}");
    Assert.True(
      confirmResponse2.StatusCode == HttpStatusCode.OK,
      $"Second confirm failed. Status={(int)confirmResponse2.StatusCode}. Body={secondBody}");

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    Assert.Equal(
      1,
      await dbContext.Orders.AsNoTracking().CountAsync(x => x.Id == reservedOrderId));
    Assert.Equal(
      1,
      await dbContext.PaymentHistories.AsNoTracking().CountAsync(x => x.OrderId == reservedOrderId));
  }

  [Fact]
  public async Task Checkout_WithPaymentIntent_ShouldNotCreateOrderBeforeAdminConfirmation_AndNoTimeoutDeletion()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, no timeout",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);

    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var paymentIntentId = checkoutPayload.GetProperty("paymentIntentId").GetGuid();
    var reservedOrderId = checkoutPayload.GetProperty("reservedOrderId").GetGuid();

    await Task.Delay(1500);

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var paymentIntent = await dbContext.PaymentIntents
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == paymentIntentId);

    Assert.NotNull(paymentIntent);
    Assert.Equal(PaymentIntentState.AwaitingAdminConfirmation, paymentIntent!.State);
    Assert.False(await dbContext.Orders.AsNoTracking().AnyAsync(x => x.Id == reservedOrderId));
  }

  [Fact]
  public async Task Checkout_WithSameIdempotencyKey_ShouldReturnSamePaymentIntent()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);

    var idempotencyKey = Guid.NewGuid().ToString("N");
    var checkoutPayload = new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, idempotent intent",
      IdempotencyKey = idempotencyKey
    };

    var firstResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", checkoutPayload);
    Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
    var firstJson = await ReadJsonAsync(firstResponse);

    var secondResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", checkoutPayload);
    Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
    var secondJson = await ReadJsonAsync(secondResponse);

    Assert.Equal(firstJson.GetProperty("paymentIntentId").GetGuid(), secondJson.GetProperty("paymentIntentId").GetGuid());
    Assert.Equal(firstJson.GetProperty("reservedOrderId").GetGuid(), secondJson.GetProperty("reservedOrderId").GetGuid());

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var paymentIntentCount = await dbContext.PaymentIntents
      .AsNoTracking()
      .CountAsync(x => x.ClientId == ApiTestData.Client1Id && x.IdempotencyKey == idempotencyKey);
    Assert.Equal(1, paymentIntentCount);
  }

  [Fact]
  public async Task RejectPaymentIntent_ShouldSetRejectedState_AndNotCreateOrder()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);
    using var superAdminActor = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, reject intent",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);
    var checkoutJson = await ReadJsonAsync(checkoutResponse);
    var paymentIntentId = checkoutJson.GetProperty("paymentIntentId").GetGuid();
    var reservedOrderId = checkoutJson.GetProperty("reservedOrderId").GetGuid();

    var rejectResponse = await superAdminActor.PostAsJsonAsync(
      $"/api/superadmin/payment-intents/{paymentIntentId}/reject",
      new { Reason = "manual reject in test" });
    Assert.Equal(HttpStatusCode.OK, rejectResponse.StatusCode);
    var rejectJson = await ReadJsonAsync(rejectResponse);
    Assert.Equal((int)PaymentIntentState.Rejected, rejectJson.GetProperty("paymentIntentState").GetInt32());

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    Assert.False(await dbContext.Orders.AsNoTracking().AnyAsync(x => x.Id == reservedOrderId));

    var intent = await dbContext.PaymentIntents
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == paymentIntentId);
    Assert.NotNull(intent);
    Assert.Equal(PaymentIntentState.Rejected, intent!.State);
  }

  [Fact]
  public async Task SuperAdminPaymentIntents_Endpoints_ShouldReturnData_AndBeForbiddenForClient()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);
    using var superAdminActor = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, list intents",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);
    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var paymentIntentId = checkoutPayload.GetProperty("paymentIntentId").GetGuid();

    var superAdminListResponse = await superAdminActor.GetAsync("/api/superadmin/payment-intents?states=AwaitingAdminConfirmation&page=1&pageSize=20");
    Assert.Equal(HttpStatusCode.OK, superAdminListResponse.StatusCode);
    var superAdminListPayload = await ReadJsonAsync(superAdminListResponse);
    Assert.Contains(
      superAdminListPayload.GetProperty("paymentIntents").EnumerateArray().Select(x => x.GetProperty("id").GetGuid()),
      id => id == paymentIntentId);

    var clientForbiddenResponse = await clientActor.GetAsync("/api/superadmin/payment-intents?page=1&pageSize=20");
    Assert.Equal(HttpStatusCode.Forbidden, clientForbiddenResponse.StatusCode);
  }
}
