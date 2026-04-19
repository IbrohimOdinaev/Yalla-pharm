namespace Yalla.Application.Common;

public sealed class SmsTemplatesOptions
{
  public const string SectionName = "SmsTemplates";

  public string Provider { get; set; } = "OsonSms";
  public string PaymentConfirmed { get; set; } = string.Empty;
  public Dictionary<string, string> OrderStatus { get; set; } = new(StringComparer.OrdinalIgnoreCase);

  /// <summary>Templates keyed by JURA status_id (stringified int). Supports {orderId}, {receiptCode}.</summary>
  public Dictionary<string, string> JuraDelivery { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
