using System.Net;
using Yalla.Presentation.Tests.Helpers;

namespace Yalla.Presentation.Tests.Controllers;

public sealed class AuthorizationIntegrationTests
{
    [Fact]
    public async Task ProtectedEndpoint_WhenNoTokenProvided_ShouldReturnUnauthorized()
    {
        await using ApiWebApplicationFactory factory = new();
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync($"/api/orders/order-number/{TestIds.Id("order-1")}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WhenRoleIsNotAllowed_ShouldReturnForbidden()
    {
        await using ApiWebApplicationFactory factory = new(ApiWebApplicationFactory.CreatePrincipal("Courier"));
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync($"/api/orders/order-number/{TestIds.Id("order-1")}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WhenRoleIsAllowed_ShouldReturnOk()
    {
        await using ApiWebApplicationFactory factory = new(ApiWebApplicationFactory.CreatePrincipal("Administrator"));
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync($"/api/orders/order-number/{TestIds.Id("order-1")}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        string content = await response.Content.ReadAsStringAsync();
        Assert.Contains("N-1", content);
    }

    [Fact]
    public async Task MethodProtectedEndpoint_WhenControllerRoleAllowedButMethodRoleDenied_ShouldReturnForbidden()
    {
        await using ApiWebApplicationFactory factory = new(ApiWebApplicationFactory.CreatePrincipal("Operator"));
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.DeleteAsync($"/api/orders/{TestIds.Id("order-1")}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task MethodProtectedEndpoint_WhenMethodRoleAllowed_ShouldReturnOk()
    {
        await using ApiWebApplicationFactory factory = new(ApiWebApplicationFactory.CreatePrincipal("Administrator"));
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.DeleteAsync($"/api/orders/{TestIds.Id("order-1")}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
