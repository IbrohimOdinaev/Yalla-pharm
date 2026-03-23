namespace Yalla.Infrastructure.Sms;

public sealed class OsonSmsOptions
{
  public const string SectionName = "OsonSms";

  public string ApiBaseUrl { get; set; } = "https://api.osonsms.com";
  public string Login { get; set; } = string.Empty;
  public string Token { get; set; } = string.Empty;
  public string Sender { get; set; } = string.Empty;
  public bool IsConfidential { get; set; } = true;
  public bool UseStub { get; set; } = true;
  public int TimeoutSeconds { get; set; } = 20;
}
