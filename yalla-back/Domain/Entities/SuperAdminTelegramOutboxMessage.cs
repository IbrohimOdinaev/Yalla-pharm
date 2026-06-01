using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class SuperAdminTelegramOutboxMessage
{
  public Guid Id { get; private set; }
  public Guid? OrderId { get; private set; }
  public Guid? PrescriptionId { get; private set; }
  public Guid SuperAdminId { get; private set; }
  public Guid? PharmacyId { get; private set; }
  public long ChatId { get; private set; }
  public string MessageKey { get; private set; } = string.Empty;
  public string Message { get; private set; } = string.Empty;
  public int AttemptCount { get; private set; }
  public DateTime NextAttemptAtUtc { get; private set; }
  public DateTime? SentAtUtc { get; private set; }
  public TelegramOutboxState State { get; private set; }
  public long? TelegramMessageId { get; private set; }
  public string? LastErrorCode { get; private set; }
  public string? LastErrorMessage { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }

  private SuperAdminTelegramOutboxMessage() { }

  public static SuperAdminTelegramOutboxMessage CreateForOrder(
    Guid orderId,
    Guid pharmacyId,
    Guid superAdminId,
    long chatId,
    string eventKey,
    string message,
    DateTime nowUtc)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    return Create(
      orderId: orderId,
      prescriptionId: null,
      pharmacyId: pharmacyId,
      superAdminId: superAdminId,
      chatId: chatId,
      messageKey: $"order:{orderId:D}:{NormalizeEventKey(eventKey)}",
      message: message,
      nowUtc: nowUtc);
  }

  public static SuperAdminTelegramOutboxMessage CreateForPrescription(
    Guid prescriptionId,
    Guid superAdminId,
    long chatId,
    string message,
    DateTime nowUtc)
  {
    if (prescriptionId == Guid.Empty)
      throw new DomainArgumentException("PrescriptionId can't be empty.");

    return Create(
      orderId: null,
      prescriptionId: prescriptionId,
      pharmacyId: null,
      superAdminId: superAdminId,
      chatId: chatId,
      messageKey: $"prescription:{prescriptionId:D}:created",
      message: message,
      nowUtc: nowUtc);
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

  public void ScheduleRetry(DateTime nextAttemptAtUtc, string? errorCode, string? errorMessage)
  {
    var normalizedNextAttemptAtUtc = EnsureUtc(nextAttemptAtUtc);
    var nowUtc = DateTime.UtcNow;
    if (normalizedNextAttemptAtUtc <= nowUtc)
      normalizedNextAttemptAtUtc = nowUtc.AddSeconds(1);

    AttemptCount += 1;
    State = TelegramOutboxState.Pending;
    NextAttemptAtUtc = normalizedNextAttemptAtUtc;
    LastErrorCode = NormalizeOptional(errorCode, 64, nameof(LastErrorCode));
    LastErrorMessage = NormalizeOptional(errorMessage, 512, nameof(LastErrorMessage));
    UpdatedAtUtc = EnsureUtc(DateTime.UtcNow);
  }

  public void MarkFailed(DateTime failedAtUtc, string? errorCode, string? errorMessage)
  {
    var normalizedFailedAtUtc = EnsureUtc(failedAtUtc);

    AttemptCount += 1;
    State = TelegramOutboxState.Failed;
    NextAttemptAtUtc = normalizedFailedAtUtc;
    LastErrorCode = NormalizeOptional(errorCode, 64, nameof(LastErrorCode));
    LastErrorMessage = NormalizeOptional(errorMessage, 512, nameof(LastErrorMessage));
    UpdatedAtUtc = normalizedFailedAtUtc;
  }

  private static SuperAdminTelegramOutboxMessage Create(
    Guid? orderId,
    Guid? prescriptionId,
    Guid? pharmacyId,
    Guid superAdminId,
    long chatId,
    string messageKey,
    string message,
    DateTime nowUtc)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");
    if (chatId == 0)
      throw new DomainArgumentException("ChatId can't be zero.");

    var normalizedNowUtc = EnsureUtc(nowUtc);

    return new SuperAdminTelegramOutboxMessage
    {
      Id = Guid.NewGuid(),
      OrderId = orderId,
      PrescriptionId = prescriptionId,
      PharmacyId = pharmacyId,
      SuperAdminId = superAdminId,
      ChatId = chatId,
      MessageKey = NormalizeRequired(messageKey, 128, nameof(MessageKey)),
      Message = NormalizeRequired(message, 4000, nameof(Message)),
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

  private static string NormalizeEventKey(string value)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException("EventKey can't be null or whitespace.");

    var normalized = value.Trim().ToLowerInvariant();
    if (normalized.Length > 48)
      throw new DomainArgumentException("EventKey length can't exceed 48.");

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
