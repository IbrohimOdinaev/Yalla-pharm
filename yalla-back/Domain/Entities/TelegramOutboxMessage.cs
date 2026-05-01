using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// Outbox row for Telegram order-status notifications. Mirrors <see cref="SmsOutboxMessage"/>
/// but is keyed by the recipient's Telegram chat id (== user id) rather than a phone number.
/// One row per (OrderId, StatusSnapshot, ChatId) — uniqueness is enforced at the DB layer to
/// guarantee idempotent enqueue from the polling worker.
/// </summary>
public sealed class TelegramOutboxMessage
{
  public Guid Id { get; private set; }
  public Guid OrderId { get; private set; }
  public long ChatId { get; private set; }
  public Status StatusSnapshot { get; private set; }
  /// <summary>Discriminator for cases where multiple TG messages per order+status are needed (e.g. JURA phases all map to OnTheWay).</summary>
  public string? MessageKey { get; private set; }
  public string Message { get; private set; } = string.Empty;
  public int AttemptCount { get; private set; }
  public DateTime NextAttemptAtUtc { get; private set; }
  public DateTime? SentAtUtc { get; private set; }
  public TelegramOutboxState State { get; private set; }
  /// <summary>Telegram message_id returned by sendMessage on success.</summary>
  public long? TelegramMessageId { get; private set; }
  public string? LastErrorCode { get; private set; }
  public string? LastErrorMessage { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }

  private TelegramOutboxMessage() { }

  public static TelegramOutboxMessage CreatePending(
    Guid orderId,
    long chatId,
    Status statusSnapshot,
    string message,
    DateTime nowUtc,
    string? messageKey = null)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    if (chatId == 0)
      throw new DomainArgumentException("ChatId can't be zero.");

    var normalizedNowUtc = EnsureUtc(nowUtc);

    return new TelegramOutboxMessage
    {
      Id = Guid.NewGuid(),
      OrderId = orderId,
      ChatId = chatId,
      StatusSnapshot = statusSnapshot,
      MessageKey = NormalizeOptional(messageKey, 64, "MessageKey"),
      Message = NormalizeRequired(message, 4000, "Message"),
      AttemptCount = 0,
      NextAttemptAtUtc = normalizedNowUtc,
      SentAtUtc = null,
      State = TelegramOutboxState.Pending,
      TelegramMessageId = null,
      LastErrorCode = null,
      LastErrorMessage = null,
      CreatedAtUtc = normalizedNowUtc,
      UpdatedAtUtc = normalizedNowUtc
    };
  }

  public void MarkSent(DateTime sentAtUtc, long? telegramMessageId)
  {
    var normalizedSentAtUtc = EnsureUtc(sentAtUtc);

    State = TelegramOutboxState.Sent;
    SentAtUtc = normalizedSentAtUtc;
    NextAttemptAtUtc = normalizedSentAtUtc;
    TelegramMessageId = telegramMessageId;
    LastErrorCode = null;
    LastErrorMessage = null;
    UpdatedAtUtc = normalizedSentAtUtc;
  }

  public void MarkProcessing(DateTime startedAtUtc)
  {
    State = TelegramOutboxState.Processing;
    UpdatedAtUtc = EnsureUtc(startedAtUtc);
  }

  public void ScheduleRetry(DateTime nextAttemptAtUtc, string? errorCode, string? errorMessage)
  {
    var normalizedNextAttemptAtUtc = EnsureUtc(nextAttemptAtUtc);
    var nowUtc = DateTime.UtcNow;
    if (normalizedNextAttemptAtUtc <= nowUtc)
      normalizedNextAttemptAtUtc = nowUtc.AddSeconds(1);

    AttemptCount += 1;
    State = TelegramOutboxState.Pending;
    NextAttemptAtUtc = normalizedNextAttemptAtUtc;
    LastErrorCode = NormalizeOptional(errorCode, 64, "LastErrorCode");
    LastErrorMessage = NormalizeOptional(errorMessage, 512, "LastErrorMessage");
    UpdatedAtUtc = EnsureUtc(DateTime.UtcNow);
  }

  public void MarkFailed(DateTime failedAtUtc, string? errorCode, string? errorMessage)
  {
    var normalizedFailedAtUtc = EnsureUtc(failedAtUtc);

    AttemptCount += 1;
    State = TelegramOutboxState.Failed;
    NextAttemptAtUtc = normalizedFailedAtUtc;
    LastErrorCode = NormalizeOptional(errorCode, 64, "LastErrorCode");
    LastErrorMessage = NormalizeOptional(errorMessage, 512, "LastErrorMessage");
    UpdatedAtUtc = normalizedFailedAtUtc;
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
