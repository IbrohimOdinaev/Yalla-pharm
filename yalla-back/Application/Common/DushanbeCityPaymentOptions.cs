namespace Yalla.Application.Common;

public sealed class DushanbeCityPaymentOptions
{
  public const string SectionName = "DushanbeCityPayment";

  public string BaseUrl { get; set; } = "http://pay.expresspay.tj/?A=9762000087892609&s=&c=&f1=133&FIELD2=&FIELD3=";
  public string AlifUrlTemplate { get; set; } = "https://alifmobi.page.link/toMobi?account=%2B992926406699&summa={amount}&_imcp=1";
  public string EskhataUrlTemplate { get; set; } = "eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992927964433/{amount}/DA00126FM";
  public string ProviderName { get; set; } = "DushanbeCityManualPhone";
  public string Currency { get; set; } = "TJS";
  public bool CreateOrderOnlyAfterAdminPaymentConfirmation { get; set; } = true;
  public int PendingConfirmationTimeoutMinutes { get; set; } = 5;
  public int CleanupIntervalSeconds { get; set; } = 30;
}
