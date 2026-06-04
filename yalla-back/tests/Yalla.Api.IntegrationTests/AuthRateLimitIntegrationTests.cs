using System.Net;
using System.Net.Http.Json;
using Yalla.Api.IntegrationTests.TestInfrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class AuthRateLimitIntegrationTests
{
  [Fact]
  public async Task Login_WhenRateLimitExceeded_ShouldReturnTooManyRequests()
  {
    using var factory = new ApiWebApplicationFactory(new Dictionary<string, string?>
    {
      ["Auth:LoginRateLimitPerMinute"] = "1"
    });
    await factory.ResetDatabaseAsync();
    using var client = factory.CreateApiClient();

    var first = await client.PostAsJsonAsync("/api/auth/login", new
    {
      PhoneNumber = "900000001",
      Password = "wrong-password"
    });
    var second = await client.PostAsJsonAsync("/api/auth/login", new
    {
      PhoneNumber = "900000001",
      Password = "wrong-password"
    });

    Assert.Equal(HttpStatusCode.BadRequest, first.StatusCode);
    Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
  }
}
