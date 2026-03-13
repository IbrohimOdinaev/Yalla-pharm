using Yalla.Api.IntegrationTests.Fixtures;

namespace Yalla.Api.IntegrationTests.Scenarios.Auth;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class LoginIntegrationTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    [Trait("Category", "Smoke")]
    public async Task Login_WithValidCredentials_ShouldReturnJwtToken()
    {
        using HttpClient client = fixture.CreateClient();

        var request = new
        {
            email = "admin.integration@yalla.test",
            password = "Password123!"
        };

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/login", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using JsonDocument document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        string token = document.RootElement.GetProperty("token").GetString()!;
        string user = document.RootElement.GetProperty("user").GetString()!;

        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.Equal("admin.integration@yalla.test", user);

        JwtSecurityToken jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Contains(jwt.Claims, claim => claim.Type == ClaimTypes.Role && claim.Value == "Administrator");
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ShouldReturnUnauthorized()
    {
        using HttpClient client = fixture.CreateClient();

        var request = new
        {
            email = "admin.integration@yalla.test",
            password = "WrongPassword123!"
        };

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/login", request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        string payload = await response.Content.ReadAsStringAsync();
        Assert.Contains("Invalid email or password", payload);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
