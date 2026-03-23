namespace Yalla.Infrastructure.Security;

public sealed class JwtOptions
{
  public string Issuer { get; init; } = "Yalla.Api";
  public string Audience { get; init; } = "Yalla.Api.Client";
  public string Key { get; init; } = string.Empty;
  public int AccessTokenMinutes { get; init; } = 43200;
}
