using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Sms;

public sealed class OsonRequestSigningContext
{
  public required bool IsSendRequest { get; init; }
  public SmsSendCommand? SendCommand { get; init; }
  public SmsDeliveryVerificationCommand? VerifyCommand { get; init; }
  public string? NormalizedPhoneNumber { get; init; }
}
