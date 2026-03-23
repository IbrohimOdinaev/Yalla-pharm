using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public interface ISmsService
{
  Task<SmsSendResponse> SendSmsAsync(
    SmsSendRequest request,
    CancellationToken cancellationToken = default);

  Task<SmsSendResponse> ResendSmsAsync(
    SmsResendRequest request,
    CancellationToken cancellationToken = default);

  Task<SmsVerifyResponse> VerifySmsAsync(
    SmsVerifyRequest request,
    CancellationToken cancellationToken = default);
}

public sealed class SmsSendRequest
{
  public SmsVerificationPurpose Purpose { get; init; }
  public string PhoneNumber { get; init; } = string.Empty;
  public string? PayloadJson { get; init; }
  public string? MessageTemplate { get; init; }
}

public sealed class SmsResendRequest
{
  public Guid SessionId { get; init; }
}

public sealed class SmsVerifyRequest
{
  public Guid SessionId { get; init; }
  public string Code { get; init; } = string.Empty;
}

public sealed class SmsSendResponse
{
  public Guid SessionId { get; init; }
  public string PhoneNumber { get; init; } = string.Empty;
  public DateTime ExpiresAtUtc { get; init; }
  public DateTime ResendAvailableAtUtc { get; init; }
  public int CodeLength { get; init; }
  public int AttemptsRemaining { get; init; }
  public int ResendsRemaining { get; init; }
}

public sealed class SmsVerifyResponse
{
  public bool IsSuccess { get; init; }
  public SmsVerificationFailureReason FailureReason { get; init; }
  public Guid SessionId { get; init; }
  public SmsVerificationPurpose Purpose { get; init; }
  public string PhoneNumber { get; init; } = string.Empty;
  public string? PayloadJson { get; init; }
  public int AttemptsRemaining { get; init; }
  public DateTime? ExpiresAtUtc { get; init; }
}

public enum SmsVerificationFailureReason
{
  None = 0,
  NotFound = 1,
  InvalidCode = 2,
  Expired = 3,
  AttemptsExceeded = 4,
  AlreadyCompleted = 5
}
