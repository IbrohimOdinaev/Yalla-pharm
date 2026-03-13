using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests.TestInfrastructure;

[Collection("ApiIntegration")]
public abstract class ApiTestBase : IAsyncLifetime
{
  protected ApiWebApplicationFactory Factory { get; }

  protected ApiTestBase(ApiWebApplicationFactory factory)
  {
    Factory = factory;
  }

  public async Task InitializeAsync()
  {
    await Factory.ResetDatabaseAsync();
  }

  public Task DisposeAsync()
  {
    return Task.CompletedTask;
  }

  protected HttpClient CreateClient()
  {
    return Factory.CreateApiClient();
  }

  protected async Task<HttpClient> CreateAuthorizedClientAsync(TestActor actor)
  {
    var client = CreateClient();
    var token = await LoginAndGetTokenAsync(client, actor);
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    return client;
  }

  protected async Task<string> LoginAndGetTokenAsync(HttpClient client, TestActor actor)
  {
    var (phone, password) = ApiTestData.GetCredentials(actor);
    var response = await client.PostAsJsonAsync("/api/auth/login", new
    {
      PhoneNumber = phone,
      Password = password
    });

    if (!response.IsSuccessStatusCode)
    {
      var body = await response.Content.ReadAsStringAsync();
      using var scope = Factory.CreateScope();
      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var users = await db.Users
        .AsNoTracking()
        .Select(x => new { x.Id, x.Name, x.PhoneNumber, x.Role, HasPassword = !string.IsNullOrWhiteSpace(x.PasswordHash) })
        .ToListAsync();
      var usersDump = string.Join(
        " | ",
        users.Select(x => $"{x.Name}:{x.PhoneNumber}:{x.Role}:pwd={x.HasPassword}"));
      throw new HttpRequestException(
        $"Login failed with status {(int)response.StatusCode} ({response.StatusCode}). Body: {body}. SeedUsers[{users.Count}]: {usersDump}");
    }

    var json = await ReadJsonAsync(response);
    return json.GetProperty("accessToken").GetString()
      ?? throw new InvalidOperationException("Access token is missing in login response.");
  }

  protected static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
  {
    using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
    return document.RootElement.Clone();
  }
}
