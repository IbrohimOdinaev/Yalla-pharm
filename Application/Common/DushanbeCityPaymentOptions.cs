namespace Yalla.Application.Common;

public sealed class DushanbeCityPaymentOptions
{
  public const string SectionName = "DushanbeCityPayment";

  public string BaseUrl { get; set; } = "http://pay.expresspay.tj/?A=9762000087892609&s=&c=&f1=133&FIELD2=&FIELD3=";
  public string ProviderName { get; set; } = "DushanbeCityManualPhone";
  public string Currency { get; set; } = "TJS";
  public int PendingConfirmationTimeoutMinutes { get; set; } = 5;
  public int CleanupIntervalSeconds { get; set; } = 30;
}
