namespace Yalla.Infrastructure.Sms;

public sealed class OsonSmsOptions
{
  public const string SectionName = "OsonSms";

  public string ApiBaseUrl { get; set; } = "https://api.osonsms.com";
  public string AuthMode { get; set; } = "Bearer";
  public string Login { get; set; } = string.Empty;
  public string Token { get; set; } = string.Empty;
  public string Sender { get; set; } = string.Empty;
  public string PassSaltHash { get; set; } = string.Empty;
  public string Delimiter { get; set; } = ";";
  public string T { get; set; } = "23";
  public bool IsConfidential { get; set; } = true;
  public bool UseStub { get; set; } = true;
  public int TimeoutSeconds { get; set; } = 20;
  public int MaxRetryAttempts { get; set; } = 2;
  public int RetryBackoffSeconds { get; set; } = 2;
}
