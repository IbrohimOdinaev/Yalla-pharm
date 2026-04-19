using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class SmsOutboxMessage
{
  public Guid Id { get; private set; }
  public Guid OrderId { get; private set; }
  public string PhoneNumber { get; private set; } = string.Empty;
  public Status StatusSnapshot { get; private set; }
  /// <summary>
  /// Discriminator for dedup when multiple SMS per order+status need to be distinguished
  /// (e.g. JURA delivery phases 4/7/9/10 all map to <see cref="Status.OnTheWay"/>).
  /// </summary>
  public string? MessageKey { get; private set; }
  public string Message { get; private set; } = string.Empty;
  public string Provider { get; private set; } = string.Empty;
  public int AttemptCount { get; private set; }
  public DateTime NextAttemptAtUtc { get; private set; }
  public DateTime? SentAtUtc { get; private set; }
  public SmsOutboxState State { get; private set; }
  public string? TxnId { get; private set; }
  public string? MsgId { get; private set; }
  public string? LastErrorCode { get; private set; }
  public string? LastErrorMessage { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }

  private SmsOutboxMessage() { }

  public static SmsOutboxMessage CreatePending(
    Guid orderId,
    string phoneNumber,
    Status statusSnapshot,
    string message,
    string provider,
    DateTime nowUtc,
    string? messageKey = null)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    var normalizedNowUtc = EnsureUtc(nowUtc);

    return new SmsOutboxMessage
    {
      Id = Guid.NewGuid(),
      OrderId = orderId,
      PhoneNumber = NormalizePhoneNumber(phoneNumber),
      StatusSnapshot = statusSnapshot,
      MessageKey = NormalizeOptional(messageKey, 64, "MessageKey"),
      Message = NormalizeRequired(message, 1000, "Message"),
      Provider = NormalizeRequired(provider, 64, "Provider"),
      AttemptCount = 0,
      NextAttemptAtUtc = normalizedNowUtc,
      SentAtUtc = null,
      State = SmsOutboxState.Pending,
      TxnId = null,
      MsgId = null,
      LastErrorCode = null,
      LastErrorMessage = null,
      CreatedAtUtc = normalizedNowUtc,
      UpdatedAtUtc = normalizedNowUtc
    };
  }

  public void MarkSent(
    DateTime sentAtUtc,
    string? txnId,
    string? msgId)
  {
    var normalizedSentAtUtc = EnsureUtc(sentAtUtc);

    State = SmsOutboxState.Sent;
    SentAtUtc = normalizedSentAtUtc;
    NextAttemptAtUtc = normalizedSentAtUtc;
    TxnId = NormalizeOptional(txnId, 128, "TxnId");
    MsgId = NormalizeOptional(msgId, 128, "MsgId");
    LastErrorCode = null;
    LastErrorMessage = null;
    UpdatedAtUtc = normalizedSentAtUtc;
  }

  public void MarkProcessing(DateTime startedAtUtc)
  {
    var normalizedStartedAtUtc = EnsureUtc(startedAtUtc);
    State = SmsOutboxState.Processing;
    UpdatedAtUtc = normalizedStartedAtUtc;
  }

  public void ScheduleRetry(
    DateTime nextAttemptAtUtc,
    string? errorCode,
    string? errorMessage,
    string? txnId = null,
    string? msgId = null)
  {
    var normalizedNextAttemptAtUtc = EnsureUtc(nextAttemptAtUtc);
    var nowUtc = DateTime.UtcNow;
    if (normalizedNextAttemptAtUtc <= nowUtc)
      normalizedNextAttemptAtUtc = nowUtc.AddSeconds(1);

    AttemptCount += 1;
    State = SmsOutboxState.Pending;
    NextAttemptAtUtc = normalizedNextAttemptAtUtc;
    TxnId = NormalizeOptional(txnId, 128, "TxnId");
    MsgId = NormalizeOptional(msgId, 128, "MsgId");
    LastErrorCode = NormalizeOptional(errorCode, 64, "LastErrorCode");
    LastErrorMessage = NormalizeOptional(errorMessage, 512, "LastErrorMessage");
    UpdatedAtUtc = EnsureUtc(DateTime.UtcNow);
  }

  public void MarkFailed(
    DateTime failedAtUtc,
    string? errorCode,
    string? errorMessage,
    string? txnId = null,
    string? msgId = null)
  {
    var normalizedFailedAtUtc = EnsureUtc(failedAtUtc);

    AttemptCount += 1;
    State = SmsOutboxState.Failed;
    NextAttemptAtUtc = normalizedFailedAtUtc;
    TxnId = NormalizeOptional(txnId, 128, "TxnId");
    MsgId = NormalizeOptional(msgId, 128, "MsgId");
    LastErrorCode = NormalizeOptional(errorCode, 64, "LastErrorCode");
    LastErrorMessage = NormalizeOptional(errorMessage, 512, "LastErrorMessage");
    UpdatedAtUtc = normalizedFailedAtUtc;
  }

  public void Touch(DateTime nowUtc)
  {
    UpdatedAtUtc = EnsureUtc(nowUtc);
  }

  private static string NormalizePhoneNumber(string value)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException("PhoneNumber can't be null or whitespace.");

    var digits = new string(value.Where(char.IsDigit).ToArray());
    if (digits.StartsWith("992", StringComparison.Ordinal) && digits.Length == 12)
      digits = digits[3..];

    if (digits.Length != 9)
      throw new DomainArgumentException("PhoneNumber must contain exactly 9 digits (without +992 prefix).");

    return digits;
  }

  private static string NormalizeRequired(string value, int maxLength, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException($"{fieldName} can't be null or whitespace.");

    var normalized = value.Trim();
    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

    return normalized;
  }

  private static string? NormalizeOptional(string? value, int maxLength, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(value))
      return null;

    var normalized = value.Trim();
    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

    return normalized;
  }

  private static DateTime EnsureUtc(DateTime value)
  {
    return value.Kind switch
    {
      DateTimeKind.Utc => value,
      DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
      _ => value.ToUniversalTime()
    };
  }
}
