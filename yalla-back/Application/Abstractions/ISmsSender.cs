namespace Yalla.Application.Abstractions;

public interface ISmsSender
{
  Task<SmsSendResult> SendSmsAsync(
    SmsSendCommand command,
    CancellationToken cancellationToken = default);

  Task<SmsDeliveryVerificationResult> VerifySmsAsync(
    SmsDeliveryVerificationCommand command,
    CancellationToken cancellationToken = default);
}

public sealed class SmsSendCommand
{
  public string PhoneNumber { get; init; } = string.Empty;
  public string Message { get; init; } = string.Empty;
  public string TxnId { get; init; } = string.Empty;
  public bool IsConfidential { get; init; } = true;
}

public sealed class SmsSendResult
{
  public bool IsSuccess { get; init; }
  public int StatusCode { get; init; }
  public string? TxnId { get; init; }
  public string? MsgId { get; init; }
  public string? ErrorCode { get; init; }
  public string? ErrorMessage { get; init; }
}

public sealed class SmsDeliveryVerificationCommand
{
  public string? TxnId { get; init; }
  public string? MsgId { get; init; }
}

public sealed class SmsDeliveryVerificationResult
{
  public bool IsSuccess { get; init; }
  public int StatusCode { get; init; }
  public string? DeliveryStatus { get; init; }
  public string? ErrorCode { get; init; }
  public string? ErrorMessage { get; init; }
}
