namespace Yalla.Application.Common;

public sealed class OneCImportOptions
{
  public const string SectionName = "OneCImport";

  public bool Enabled { get; set; } = false;
  public string ExchangeDirectory { get; set; } = "/data/1c-exchange";
  public int PollIntervalSeconds { get; set; } = 60;
  public int StableFileSeconds { get; set; } = 30;
  public string DefaultSourceToken { get; set; } = string.Empty;
  public string DefaultSourceName { get; set; } = "1C";
  public string DefaultPharmacyId { get; set; } = string.Empty;
}
