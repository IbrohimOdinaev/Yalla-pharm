using System.Net;
using System.Net.Http.Json;
using Yalla.Api.IntegrationTests.TestInfrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class AuthorizationMatrixIntegrationTests : ApiTestBase
{
  public AuthorizationMatrixIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Theory]
  [MemberData(nameof(GetProtectedEndpoints))]
  public async Task ProtectedEndpoints_WithoutToken_ShouldReturnUnauthorized(
    HttpMethod method,
    string url,
    object? body)
  {
    using var client = CreateClient();
    using var request = new HttpRequestMessage(method, url);

    if (body is not null)
      request.Content = JsonContent.Create(body);

    var response = await client.SendAsync(request);

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  public static IEnumerable<object?[]> GetProtectedEndpoints()
  {
    yield return [HttpMethod.Post, "/api/auth/change-password", new { currentPassword = "old", newPassword = "new" }];

    yield return [HttpMethod.Get, "/api/clients/me", null];
    yield return [HttpMethod.Get, $"/api/clients/{ApiTestData.Client1Id}", null];
    yield return [HttpMethod.Put, "/api/clients/me", new { name = "Name", phoneNumber = "900100001" }];
    yield return [HttpMethod.Delete, "/api/clients/me", null];
    yield return [HttpMethod.Put, "/api/clients", new { clientId = ApiTestData.Client1Id, name = "Name", phoneNumber = "900100001" }];
    yield return [HttpMethod.Delete, "/api/clients", new { clientId = ApiTestData.Client1Id }];
    yield return [HttpMethod.Get, "/api/clients?page=1&pageSize=10", null];
    yield return [HttpMethod.Get, "/api/clients/with-basket?page=1&pageSize=10", null];
    yield return [HttpMethod.Get, "/api/clients/by-phone?phoneNumber=900000004", null];
    yield return [HttpMethod.Post, "/api/clients/checkout/preview", new { pharmacyId = ApiTestData.Pharmacy1Id, deliveryAddress = "Address", idempotencyKey = "key-1" }];
    yield return [HttpMethod.Post, "/api/clients/checkout", new { pharmacyId = ApiTestData.Pharmacy1Id, deliveryAddress = "Address", idempotencyKey = "key-1" }];

    yield return [HttpMethod.Get, "/api/basket", null];
    yield return [HttpMethod.Post, "/api/basket/items", new { medicineId = ApiTestData.Medicine1Id, quantity = 1 }];
    yield return [HttpMethod.Patch, "/api/basket/items/quantity", new { positionId = ApiTestData.BasketPosition1Id, quantity = 1 }];
    yield return [HttpMethod.Delete, "/api/basket/items", new { positionId = ApiTestData.BasketPosition1Id }];
    yield return [HttpMethod.Delete, "/api/basket", new { }];

    yield return [HttpMethod.Post, "/api/medicines", new { title = "X", articul = "Y", atributes = new[] { new { name = "n", option = "o" } } }];
    yield return [HttpMethod.Put, "/api/medicines", new { medicineId = ApiTestData.Medicine1Id, title = "X", articul = "Y", url = "https://example.com" }];
    yield return [HttpMethod.Delete, "/api/medicines", new { medicineId = ApiTestData.Medicine1Id }];

    yield return [HttpMethod.Get, "/api/pharmacies", null];
    yield return [HttpMethod.Post, "/api/pharmacies", new { title = "New Pharmacy", address = "Addr", adminId = ApiTestData.Admin1Id }];
    yield return [HttpMethod.Put, "/api/pharmacies", new { pharmacyId = ApiTestData.Pharmacy1Id, title = "Updated", address = "Addr2", adminId = ApiTestData.Admin1Id, isActive = true }];
    yield return [HttpMethod.Delete, "/api/pharmacies", new { pharmacyId = ApiTestData.Pharmacy1Id }];

    yield return [HttpMethod.Get, "/api/admins?page=1&pageSize=10", null];
    yield return [HttpMethod.Post, "/api/admins/register", new { name = "Admin", phoneNumber = "900100009", password = "Pass123!", pharmacyId = ApiTestData.Pharmacy1Id }];
    yield return [HttpMethod.Delete, "/api/admins", new { pharmacyWorkerId = ApiTestData.WorkerInPharmacy1Id }];
    yield return [HttpMethod.Put, "/api/admins/me", new { name = "Admin New", phoneNumber = "900100002" }];
    yield return [HttpMethod.Put, $"/api/admins/{ApiTestData.Admin1Id}", new { name = "Admin New", phoneNumber = "900100002" }];

    yield return [HttpMethod.Post, "/api/pharmacy-workers", new { name = "Worker", phoneNumber = "900100003", password = "Pass123!", pharmacyId = ApiTestData.Pharmacy1Id }];
    yield return [HttpMethod.Delete, "/api/pharmacy-workers", new { pharmacyWorkerId = ApiTestData.WorkerInPharmacy1Id }];

    yield return [HttpMethod.Get, $"/api/orders/client-history?clientId={ApiTestData.Client1Id}", null];
    yield return [HttpMethod.Get, "/api/orders/all?page=1&pageSize=10", null];
    yield return [HttpMethod.Get, $"/api/orders/{ApiTestData.OrderUnderReviewId}", null];
    yield return [HttpMethod.Get, "/api/orders/worker/new?take=10", null];
    yield return [HttpMethod.Get, "/api/orders/admin/pharmacy?take=10", null];
    yield return [HttpMethod.Get, "/api/orders/worker/history?page=1&pageSize=10", null];
    yield return [HttpMethod.Post, "/api/orders/assembly/start", new { orderId = ApiTestData.OrderUnderReviewId }];
    yield return [HttpMethod.Post, "/api/orders/positions/reject", new { orderId = ApiTestData.OrderPreparingId, positionIds = new[] { ApiTestData.OrderPositionPreparingId } }];
    yield return [HttpMethod.Post, "/api/orders/ready", new { orderId = ApiTestData.OrderPreparingId }];
    yield return [HttpMethod.Post, "/api/orders/on-the-way", new { orderId = ApiTestData.OrderReadyId }];
    yield return [HttpMethod.Post, "/api/orders/admin/new/delete", new { orderId = ApiTestData.OrderUnderReviewId }];
    yield return [HttpMethod.Post, "/api/orders/superadmin/next-status", new { orderId = ApiTestData.OrderUnderReviewId }];
    yield return [HttpMethod.Post, "/api/orders/delivered", new { orderId = ApiTestData.OrderOnTheWayId }];
    yield return [HttpMethod.Post, "/api/orders/cancel", new { orderId = ApiTestData.OrderCancelableId }];

    yield return [HttpMethod.Get, "/api/refund-requests?page=1&pageSize=10", null];
    yield return [HttpMethod.Post, "/api/refund-requests/initiate", new { refundRequestId = Guid.NewGuid() }];
  }
}
