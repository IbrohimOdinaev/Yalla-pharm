namespace Yalla.Infrastructure.Jura;

public sealed class JuraOptions
{
  public const string SectionName = "Jura";

  public string BaseUrl { get; set; } = string.Empty;
  public string Login { get; set; } = string.Empty;
  public string Password { get; set; } = string.Empty;
  public int DivisionId { get; set; } = 6;
  public int DefaultTariffId { get; set; } = 37;
}
