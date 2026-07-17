namespace Yalla.Infrastructure.Jura;

public sealed class JuraOptions
{
  public const string SectionName = "Jura";
  public const string DefaultBaseUrl = "https://api-3taxi.gram.tj";
  public const string LegacyBaseUrl = "https://test-admin.gram.tj";

  public string BaseUrl { get; set; } = string.Empty;
  public string Login { get; set; } = string.Empty;
  public string Password { get; set; } = string.Empty;
  public int DivisionId { get; set; } = 6;
  public int DefaultTariffId { get; set; } = 37;
  public long DefaultPayTypeId { get; set; } = 29185;

  public static string NormalizeBaseUrl(string? baseUrl)
  {
    var normalized = (baseUrl ?? string.Empty).Trim().TrimEnd('/');
    return string.Equals(normalized, LegacyBaseUrl, StringComparison.OrdinalIgnoreCase)
      ? DefaultBaseUrl
      : normalized;
  }
}
