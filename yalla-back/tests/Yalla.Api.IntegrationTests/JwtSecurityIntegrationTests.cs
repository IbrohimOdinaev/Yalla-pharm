using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Yalla.Api.IntegrationTests.TestInfrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class JwtSecurityIntegrationTests : ApiTestBase
{
  public JwtSecurityIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public async Task ProtectedEndpoint_WithWrongSigningKey_ShouldReturnUnauthorized()
  {
    using var client = CreateClient();
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(
      key: "WrongJwtKey_ForTests_AtLeast_32Chars!",
      issuer: GetJwtSetting("Issuer"),
      audience: GetJwtSetting("Audience"),
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      claims:
      [
        new Claim(ClaimTypes.NameIdentifier, ApiTestData.Client1Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Sub, ApiTestData.Client1Id.ToString()),
        new Claim(ClaimTypes.Role, "Client")
      ]));

    var response = await client.GetAsync("/api/clients/me");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  [Fact]
  public async Task ProtectedEndpoint_WithWrongIssuer_ShouldReturnUnauthorized()
  {
    using var client = CreateClient();
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(
      key: GetJwtSetting("Key"),
      issuer: "WrongIssuer",
      audience: GetJwtSetting("Audience"),
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      claims:
      [
        new Claim(ClaimTypes.NameIdentifier, ApiTestData.Client1Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Sub, ApiTestData.Client1Id.ToString()),
        new Claim(ClaimTypes.Role, "Client")
      ]));

    var response = await client.GetAsync("/api/clients/me");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  [Fact]
  public async Task ProtectedEndpoint_WithExpiredToken_ShouldReturnUnauthorized()
  {
    using var client = CreateClient();
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(
      key: GetJwtSetting("Key"),
      issuer: GetJwtSetting("Issuer"),
      audience: GetJwtSetting("Audience"),
      expiresAtUtc: DateTime.UtcNow.AddMinutes(-1),
      claims:
      [
        new Claim(ClaimTypes.NameIdentifier, ApiTestData.Client1Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Sub, ApiTestData.Client1Id.ToString()),
        new Claim(ClaimTypes.Role, "Client")
      ]));

    var response = await client.GetAsync("/api/clients/me");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  [Fact]
  public async Task AdminEndpoint_WithMissingPharmacyIdClaim_ShouldReturnUnauthorized()
  {
    using var client = CreateClient();
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(
      key: GetJwtSetting("Key"),
      issuer: GetJwtSetting("Issuer"),
      audience: GetJwtSetting("Audience"),
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      claims:
      [
        new Claim(ClaimTypes.NameIdentifier, ApiTestData.Admin1Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Sub, ApiTestData.Admin1Id.ToString()),
        new Claim(ClaimTypes.Role, "Admin")
      ]));

    var response = await client.GetAsync("/api/orders/worker/new?take=10");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
  }

  private string GetJwtSetting(string key)
  {
    using var scope = Factory.Services.CreateScope();
    var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    return configuration[$"Jwt:{key}"] ?? throw new InvalidOperationException($"Missing Jwt:{key}.");
  }

  private static string CreateToken(
    string key,
    string issuer,
    string audience,
    DateTime expiresAtUtc,
    IEnumerable<Claim> claims)
  {
    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
      issuer: issuer,
      audience: audience,
      claims: claims,
      notBefore: expiresAtUtc.AddMinutes(-5),
      expires: expiresAtUtc,
      signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(token);
  }
}
