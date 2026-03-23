using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Yalla.Application.Abstractions;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Security;

public sealed class JwtTokenProvider : IJwtTokenProvider
{
  private readonly JwtOptions _options;
  private readonly SigningCredentials _signingCredentials;

  public JwtTokenProvider(IConfiguration configuration)
  {
    ArgumentNullException.ThrowIfNull(configuration);

    var section = configuration.GetSection("Jwt");
    _options = new JwtOptions
    {
      Issuer = section["Issuer"] ?? "Yalla.Api",
      Audience = section["Audience"] ?? "Yalla.Api.Client",
      Key = section["Key"] ?? string.Empty,
      AccessTokenMinutes = int.TryParse(section["AccessTokenMinutes"], out var minutes)
        ? minutes
        : 43200
    };
    if (string.IsNullOrWhiteSpace(_options.Key))
      throw new InvalidOperationException("Jwt:Key is missing in configuration.");

    if (_options.Key.Length < 32)
      throw new InvalidOperationException("Jwt:Key must be at least 32 characters long.");

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
    _signingCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
  }

  public (string AccessToken, DateTime ExpiresAtUtc) GenerateToken(
    Guid userId,
    string name,
    string phoneNumber,
    Role role,
    Guid? pharmacyId = null)
  {
    var now = DateTime.UtcNow;
    var expiresAtUtc = now.AddMinutes(_options.AccessTokenMinutes);
    var claims = new List<Claim>
    {
      new(JwtRegisteredClaimNames.Sub, userId.ToString()),
      new(ClaimTypes.NameIdentifier, userId.ToString()),
      new(ClaimTypes.Name, name),
      new(ClaimTypes.MobilePhone, phoneNumber),
      new(ClaimTypes.Role, role.ToString())
    };

    if (role == Role.Admin)
    {
      if (!pharmacyId.HasValue || pharmacyId.Value == Guid.Empty)
        throw new InvalidOperationException("PharmacyId claim is required for Admin token.");

      claims.Add(new("pharmacy_id", pharmacyId.Value.ToString()));
    }

    var token = new JwtSecurityToken(
      issuer: _options.Issuer,
      audience: _options.Audience,
      claims: claims,
      notBefore: now,
      expires: expiresAtUtc,
      signingCredentials: _signingCredentials);

    var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
    return (accessToken, expiresAtUtc);
  }
}
