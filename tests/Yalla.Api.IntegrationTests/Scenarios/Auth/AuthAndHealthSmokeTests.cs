using Yalla.Api.IntegrationTests.Fixtures;
using Yalla.Api.IntegrationTests.TestData;
using Yalla.Application;
using Yalla.Domain.Enums;

namespace Yalla.Api.IntegrationTests.Scenarios.Auth;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class AuthAndHealthSmokeTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    [Trait("Category", "Smoke")]
    public async Task ProtectedEndpoint_WithoutToken_ShouldReturnUnauthorized()
    {
        using HttpClient client = fixture.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/paymentMethod");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "Smoke")]
    public async Task ProtectedEndpoint_WithForbiddenRole_ShouldReturnForbidden()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Courier");

        HttpResponseMessage response = await client.GetAsync("/api/paymentMethod");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "Smoke")]
    public async Task ProtectedEndpoint_WithAllowedRole_ShouldReturnOk()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.GetAsync("/api/paymentMethod");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        string payload = await response.Content.ReadAsStringAsync();
        Assert.Contains("Cash", payload);
    }

    [Fact]
    [Trait("Category", "Smoke")]
    public async Task HealthEndpoint_ShouldReturnOk()
    {
        using HttpClient client = fixture.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/telegram");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        string payload = await response.Content.ReadAsStringAsync();
        Assert.Contains("TelegramBot bot was started", payload);
    }

    [Fact]
    public async Task TelegramWebhook_Post_ShouldReturnSuccessStatus()
    {
        using HttpClient client = fixture.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/telegram", new
        {
            updateId = 1
        });

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task OrderDelete_WithOperatorRole_ShouldReturnForbidden()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Operator");

        HttpResponseMessage response = await client.DeleteAsync($"/api/orders/{Guid.Parse("99999999-9999-9999-9999-999999999999")}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task OrderConsulting_AuthorizationMatrix_ShouldReturn401403200()
    {
        DateTime referenceTime = new(2026, 2, 8, 10, 0, 0, DateTimeKind.Utc);
        SeededOrderContext seededOrder = await ScenarioSeeder.SeedOrderWithPaymentMethodAsync(
            fixture.Factory.Services,
            referenceTime,
            state: OrderState.InSearch,
            pastState: OrderState.Application,
            includePharmacyOrder: false);

        OrderConsultingDto request = RequestFactory.CreateOrderConsulting(
            seededOrder.OrderId,
            referenceTime,
            isContinue: false);

        using HttpClient noTokenClient = fixture.CreateClient();
        HttpResponseMessage noTokenResponse = await noTokenClient.PostAsJsonAsync("/api/orders/consulting", request);
        Assert.Equal(HttpStatusCode.Unauthorized, noTokenResponse.StatusCode);

        using HttpClient wrongRoleClient = fixture.CreateAuthenticatedClient("Courier");
        HttpResponseMessage wrongRoleResponse = await wrongRoleClient.PostAsJsonAsync("/api/orders/consulting", request);
        Assert.Equal(HttpStatusCode.Forbidden, wrongRoleResponse.StatusCode);

        using HttpClient allowedClient = fixture.CreateAuthenticatedClient("Administrator");
        HttpResponseMessage allowedResponse = await allowedClient.PostAsJsonAsync("/api/orders/consulting", request);
        string allowedPayload = await allowedResponse.Content.ReadAsStringAsync();
        Assert.True(allowedResponse.StatusCode == HttpStatusCode.OK, allowedPayload);
    }

    [Fact]
    public async Task OrderCancellation_AuthorizationMatrix_ShouldReturn401403200()
    {
        DateTime referenceTime = new(2026, 2, 8, 11, 0, 0, DateTimeKind.Utc);
        SeededOrderContext seededOrder = await ScenarioSeeder.SeedOrderWithPaymentMethodAsync(
            fixture.Factory.Services,
            referenceTime,
            state: OrderState.Placed,
            pastState: OrderState.Placement);

        OrderCancelDto request = RequestFactory.CreateOrderCancel(seededOrder.OrderId, referenceTime);

        using HttpClient noTokenClient = fixture.CreateClient();
        HttpResponseMessage noTokenResponse = await noTokenClient.PostAsJsonAsync(
            $"/api/orders/cancellation/{seededOrder.OrderId}",
            request);
        Assert.Equal(HttpStatusCode.Unauthorized, noTokenResponse.StatusCode);

        using HttpClient wrongRoleClient = fixture.CreateAuthenticatedClient("Courier");
        HttpResponseMessage wrongRoleResponse = await wrongRoleClient.PostAsJsonAsync(
            $"/api/orders/cancellation/{seededOrder.OrderId}",
            request);
        Assert.Equal(HttpStatusCode.Forbidden, wrongRoleResponse.StatusCode);

        using HttpClient allowedClient = fixture.CreateAuthenticatedClient("Administrator");
        HttpResponseMessage allowedResponse = await allowedClient.PostAsJsonAsync(
            $"/api/orders/cancellation/{seededOrder.OrderId}",
            request);
        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);
    }

    [Fact]
    public async Task OrderDelete_AuthorizationMatrix_ShouldReturn401403200()
    {
        DateTime referenceTime = new(2026, 2, 8, 12, 0, 0, DateTimeKind.Utc);
        SeededOrderContext seededOrder = await ScenarioSeeder.SeedOrderWithPaymentMethodAsync(
            fixture.Factory.Services,
            referenceTime);

        using HttpClient noTokenClient = fixture.CreateClient();
        HttpResponseMessage noTokenResponse = await noTokenClient.DeleteAsync($"/api/orders/{seededOrder.OrderId}");
        Assert.Equal(HttpStatusCode.Unauthorized, noTokenResponse.StatusCode);

        using HttpClient wrongRoleClient = fixture.CreateAuthenticatedClient("Operator");
        HttpResponseMessage wrongRoleResponse = await wrongRoleClient.DeleteAsync($"/api/orders/{seededOrder.OrderId}");
        Assert.Equal(HttpStatusCode.Forbidden, wrongRoleResponse.StatusCode);

        using HttpClient allowedClient = fixture.CreateAuthenticatedClient("Administrator");
        HttpResponseMessage allowedResponse = await allowedClient.DeleteAsync($"/api/orders/{seededOrder.OrderId}");
        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);
    }

    [Fact]
    public async Task ProductTemplateGetById_AuthorizationMatrix_ShouldReturn401403200()
    {
        Guid templateId = await ScenarioSeeder.SeedProductTemplateAsync(
            fixture.Factory.Services,
            name: "Auth Template Get");

        using HttpClient noTokenClient = fixture.CreateClient();
        HttpResponseMessage noTokenResponse = await noTokenClient.GetAsync($"/api/productTemplate/{templateId}");
        Assert.Equal(HttpStatusCode.Unauthorized, noTokenResponse.StatusCode);

        using HttpClient wrongRoleClient = fixture.CreateAuthenticatedClient("Operator");
        HttpResponseMessage wrongRoleResponse = await wrongRoleClient.GetAsync($"/api/productTemplate/{templateId}");
        Assert.Equal(HttpStatusCode.Forbidden, wrongRoleResponse.StatusCode);

        using HttpClient allowedClient = fixture.CreateAuthenticatedClient("Administrator");
        HttpResponseMessage allowedResponse = await allowedClient.GetAsync($"/api/productTemplate/{templateId}");
        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);
    }

    [Fact]
    public async Task ProductTemplateUpdate_AuthorizationMatrix_ShouldReturn401403200()
    {
        Guid templateId = await ScenarioSeeder.SeedProductTemplateAsync(
            fixture.Factory.Services,
            name: "Auth Template Update");
        object updateRequest = RequestFactory.CreateProductTemplate(templateId, "Auth Template Updated", "Auth update");

        using HttpClient noTokenClient = fixture.CreateClient();
        HttpResponseMessage noTokenResponse = await noTokenClient.PostAsJsonAsync("/api/productTemplate/update", updateRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, noTokenResponse.StatusCode);

        using HttpClient wrongRoleClient = fixture.CreateAuthenticatedClient("Operator");
        HttpResponseMessage wrongRoleResponse = await wrongRoleClient.PostAsJsonAsync("/api/productTemplate/update", updateRequest);
        Assert.Equal(HttpStatusCode.Forbidden, wrongRoleResponse.StatusCode);

        using HttpClient allowedClient = fixture.CreateAuthenticatedClient("Administrator");
        HttpResponseMessage allowedResponse = await allowedClient.PostAsJsonAsync("/api/productTemplate/update", updateRequest);
        string allowedPayload = await allowedResponse.Content.ReadAsStringAsync();
        Assert.True(allowedResponse.StatusCode == HttpStatusCode.OK, allowedPayload);
    }

    [Fact]
    public async Task ProductTemplateDelete_AuthorizationMatrix_ShouldReturn401403200()
    {
        Guid templateId = await ScenarioSeeder.SeedProductTemplateAsync(
            fixture.Factory.Services,
            name: "Auth Template Delete");

        using HttpClient noTokenClient = fixture.CreateClient();
        HttpResponseMessage noTokenResponse = await noTokenClient.DeleteAsync($"/api/productTemplate/{templateId}");
        Assert.Equal(HttpStatusCode.Unauthorized, noTokenResponse.StatusCode);

        using HttpClient wrongRoleClient = fixture.CreateAuthenticatedClient("Operator");
        HttpResponseMessage wrongRoleResponse = await wrongRoleClient.DeleteAsync($"/api/productTemplate/{templateId}");
        Assert.Equal(HttpStatusCode.Forbidden, wrongRoleResponse.StatusCode);

        using HttpClient allowedClient = fixture.CreateAuthenticatedClient("Administrator");
        HttpResponseMessage allowedResponse = await allowedClient.DeleteAsync($"/api/productTemplate/{templateId}");
        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
