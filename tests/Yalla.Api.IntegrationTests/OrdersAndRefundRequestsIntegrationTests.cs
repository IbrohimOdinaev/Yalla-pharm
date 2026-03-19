using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Yalla.Api.IntegrationTests.TestInfrastructure;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class OrdersAndRefundRequestsIntegrationTests : ApiTestBase
{
  public OrdersAndRefundRequestsIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public async Task Orders_ClientHistory_AsClient_ShouldIgnoreQueryClientId()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.GetAsync($"/api/orders/client-history?clientId={ApiTestData.Client2Id}");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal(ApiTestData.Client1Id, payload.GetProperty("clientId").GetGuid());
  }

  [Fact]
  public async Task Orders_GetAll_AsAdmin_ShouldReturnForbidden()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.GetAsync("/api/orders/all?page=1&pageSize=20");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task Orders_GetAll_AsSuperAdmin_ShouldReturnOk()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.GetAsync("/api/orders/all?page=1&pageSize=20");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.True(payload.GetProperty("orders").GetArrayLength() >= 1);
  }

  [Fact]
  public async Task Orders_GetClientOrderDetails_AsClient_ShouldReturnOwnOrder()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.GetAsync($"/api/orders/{ApiTestData.OrderUnderReviewId}");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal(ApiTestData.OrderUnderReviewId, payload.GetProperty("orderId").GetGuid());
  }

  [Fact]
  public async Task Orders_GetClientOrderDetails_ForAnotherClient_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.GetAsync($"/api/orders/{ApiTestData.OrderPharmacy2Id}");

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Orders_WorkerListEndpoints_AsAdmin_ShouldReturnOk()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var newOrdersResponse = await client.GetAsync("/api/orders/worker/new?take=20");
    Assert.Equal(HttpStatusCode.OK, newOrdersResponse.StatusCode);

    var pharmacyOrdersResponse = await client.GetAsync("/api/orders/admin/pharmacy?take=20");
    Assert.Equal(HttpStatusCode.OK, pharmacyOrdersResponse.StatusCode);
  }

  [Fact]
  public async Task Orders_StartAssembly_AsAdmin_ShouldMoveToPreparing()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.PostAsJsonAsync("/api/orders/assembly/start", new
    {
      OrderId = ApiTestData.OrderUnderReviewId
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var order = await dbContext.Orders.AsNoTracking().FirstAsync(x => x.Id == ApiTestData.OrderUnderReviewId);
    Assert.Equal(Status.Preparing, order.Status);
  }

  [Fact]
  public async Task Orders_StartAssembly_ForPreparing_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.PostAsJsonAsync("/api/orders/assembly/start", new
    {
      OrderId = ApiTestData.OrderPreparingId
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Orders_MarkReady_ForUnderReview_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.PostAsJsonAsync("/api/orders/ready", new
    {
      OrderId = ApiTestData.OrderUnderReviewId
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Orders_MarkReady_ThenOnTheWay_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var readyResponse = await client.PostAsJsonAsync("/api/orders/ready", new
    {
      OrderId = ApiTestData.OrderPreparingId
    });
    Assert.Equal(HttpStatusCode.OK, readyResponse.StatusCode);

    var onTheWayResponse = await client.PostAsJsonAsync("/api/orders/on-the-way", new
    {
      OrderId = ApiTestData.OrderPreparingId
    });
    Assert.Equal(HttpStatusCode.OK, onTheWayResponse.StatusCode);

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var order = await dbContext.Orders.AsNoTracking().FirstAsync(x => x.Id == ApiTestData.OrderPreparingId);
    Assert.Equal(Status.OnTheWay, order.Status);
  }

  [Fact]
  public async Task Orders_MarkOnTheWay_ForPreparing_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.PostAsJsonAsync("/api/orders/on-the-way", new
    {
      OrderId = ApiTestData.OrderPreparingId
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Orders_RejectPositions_AsAdmin_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.PostAsJsonAsync("/api/orders/positions/reject", new
    {
      OrderId = ApiTestData.OrderPreparingId,
      PositionIds = new[] { ApiTestData.OrderPositionPreparingId }
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal(1, payload.GetProperty("rejectedPositionIds").GetArrayLength());
  }

  [Fact]
  public async Task Orders_Cancel_AsClient_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.PostAsJsonAsync("/api/orders/cancel", new
    {
      OrderId = ApiTestData.OrderCancelableId
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal((int)Status.Cancelled, payload.GetProperty("status").GetInt32());
  }

  [Fact]
  public async Task Orders_Delivered_AsSuperAdmin_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.PostAsJsonAsync("/api/orders/delivered", new
    {
      OrderId = ApiTestData.OrderOnTheWayId
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal((int)Status.Delivered, payload.GetProperty("status").GetInt32());
  }

  [Fact]
  public async Task Orders_Delivered_ForReady_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.PostAsJsonAsync("/api/orders/delivered", new
    {
      OrderId = ApiTestData.OrderReadyId
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Orders_SuperAdminNextStatus_ForNew_ShouldMoveToUnderReview()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);
    using var superAdminActor = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, superadmin next status",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);

    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var orderId = checkoutPayload.GetProperty("orderId").GetGuid();
    Assert.Equal((int)Status.New, checkoutPayload.GetProperty("status").GetInt32());

    var nextStatusResponse = await superAdminActor.PostAsJsonAsync("/api/orders/superadmin/next-status", new
    {
      OrderId = orderId
    });

    Assert.Equal(HttpStatusCode.OK, nextStatusResponse.StatusCode);
    var payload = await ReadJsonAsync(nextStatusResponse);
    Assert.Equal((int)Status.UnderReview, payload.GetProperty("status").GetInt32());
  }

  [Fact]
  public async Task Orders_DeleteNew_AsAdmin_ShouldDeleteOrder()
  {
    using var clientActor = await CreateAuthorizedClientAsync(TestActor.Client1);
    using var adminActor = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var checkoutResponse = await clientActor.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, delete new order",
      IdempotencyKey = Guid.NewGuid().ToString("N")
    });
    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);

    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var orderId = checkoutPayload.GetProperty("orderId").GetGuid();
    Assert.Equal((int)Status.New, checkoutPayload.GetProperty("status").GetInt32());

    var deleteResponse = await adminActor.PostAsJsonAsync("/api/orders/admin/new/delete", new
    {
      OrderId = orderId
    });

    Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

    using var scope = Factory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var exists = await dbContext.Orders.AsNoTracking().AnyAsync(x => x.Id == orderId);
    Assert.False(exists);
  }

  [Fact]
  public async Task Orders_Checkout_ThenClientHistory_ShouldContainNonZeroCost()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var idempotencyKey = Guid.NewGuid().ToString("N");
    var checkoutResponse = await client.PostAsJsonAsync("/api/clients/checkout", new
    {
      PharmacyId = ApiTestData.Pharmacy1Id,
      DeliveryAddress = "Dushanbe, test address",
      IdempotencyKey = idempotencyKey
    });

    Assert.Equal(HttpStatusCode.OK, checkoutResponse.StatusCode);

    var checkoutPayload = await ReadJsonAsync(checkoutResponse);
    var orderId = checkoutPayload.GetProperty("orderId").GetGuid();
    var checkoutCost = checkoutPayload.GetProperty("cost").GetDecimal();
    Assert.Equal((int)Status.New, checkoutPayload.GetProperty("status").GetInt32());
    Assert.True(checkoutCost > 0m);

    var historyResponse = await client.GetAsync("/api/orders/client-history");
    Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);

    var historyPayload = await ReadJsonAsync(historyResponse);
    var historyOrders = historyPayload.GetProperty("orders").EnumerateArray().ToList();
    var checkedOutOrder = historyOrders.FirstOrDefault(x => x.GetProperty("orderId").GetGuid() == orderId);

    Assert.True(checkedOutOrder.ValueKind != System.Text.Json.JsonValueKind.Undefined);
    Assert.True(checkedOutOrder.GetProperty("cost").GetDecimal() > 0m);
  }

  [Fact]
  public async Task RefundRequests_GetList_AsSuperAdmin_ShouldReturnOk()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.GetAsync("/api/refund-requests?page=1&pageSize=20");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.True(payload.GetProperty("refundRequests").GetArrayLength() >= 1);
  }

  [Fact]
  public async Task RefundRequests_GetList_AsAdmin_ShouldReturnForbidden()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.GetAsync("/api/refund-requests?page=1&pageSize=20");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task RefundRequests_Initiate_Twice_ShouldReturnBadRequestOnSecondAttempt()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var listResponse = await client.GetAsync("/api/refund-requests?page=1&pageSize=20");
    Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

    var listPayload = await ReadJsonAsync(listResponse);
    var refundRequestId = listPayload
      .GetProperty("refundRequests")[0]
      .GetProperty("refundRequestId")
      .GetGuid();

    var firstInitiateResponse = await client.PostAsJsonAsync("/api/refund-requests/initiate", new
    {
      RefundRequestId = refundRequestId
    });
    Assert.Equal(HttpStatusCode.OK, firstInitiateResponse.StatusCode);

    var secondInitiateResponse = await client.PostAsJsonAsync("/api/refund-requests/initiate", new
    {
      RefundRequestId = refundRequestId
    });
    Assert.Equal(HttpStatusCode.BadRequest, secondInitiateResponse.StatusCode);
  }

  [Fact]
  public async Task RefundRequests_Initiate_WithEmptyId_ShouldReturnValidationError()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.PostAsJsonAsync("/api/refund-requests/initiate", new
    {
      RefundRequestId = Guid.Empty
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }
}
