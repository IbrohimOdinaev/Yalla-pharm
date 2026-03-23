using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class SmsVerificationSession
{
  public Guid Id { get; private set; }
  public SmsVerificationPurpose Purpose { get; private set; }
  public string PhoneNumber { get; private set; } = string.Empty;
  public string CodeHash { get; private set; } = string.Empty;
  public string? PayloadJson { get; private set; }
  public string? LastTxnId { get; private set; }
  public string? LastMsgId { get; private set; }
  public SmsVerificationStatus Status { get; private set; }
  public int AttemptsRemaining { get; private set; }
  public int ResendsRemaining { get; private set; }
  public DateTime ExpiresAtUtc { get; private set; }
  public DateTime ResendAvailableAtUtc { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }
  public DateTime? VerifiedAtUtc { get; private set; }
  public string? FailureReason { get; private set; }

  private SmsVerificationSession()
  {
  }

  public SmsVerificationSession(
    SmsVerificationPurpose purpose,
    string phoneNumber,
    string codeHash,
    DateTime expiresAtUtc,
    DateTime resendAvailableAtUtc,
    int attemptsRemaining,
    int resendsRemaining,
    string? payloadJson)
  {
    if (string.IsNullOrWhiteSpace(phoneNumber))
      throw new DomainArgumentException("PhoneNumber can't be null or whitespace.");

    if (!phoneNumber.All(char.IsDigit))
      throw new DomainArgumentException("PhoneNumber must contain digits only.");

    if (string.IsNullOrWhiteSpace(codeHash))
      throw new DomainArgumentException("CodeHash can't be null or whitespace.");

    if (attemptsRemaining <= 0)
      throw new DomainArgumentException("AttemptsRemaining must be greater than zero.");

    if (resendsRemaining < 0)
      throw new DomainArgumentException("ResendsRemaining can't be negative.");

    var nowUtc = DateTime.UtcNow;

    Id = Guid.NewGuid();
    Purpose = purpose;
    PhoneNumber = phoneNumber.Trim();
    CodeHash = codeHash.Trim();
    PayloadJson = string.IsNullOrWhiteSpace(payloadJson) ? null : payloadJson;
    Status = SmsVerificationStatus.Pending;
    AttemptsRemaining = attemptsRemaining;
    ResendsRemaining = resendsRemaining;
    ExpiresAtUtc = DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc);
    ResendAvailableAtUtc = DateTime.SpecifyKind(resendAvailableAtUtc, DateTimeKind.Utc);
    CreatedAtUtc = nowUtc;
    UpdatedAtUtc = nowUtc;
  }

  public void RegisterDelivery(string? txnId, string? msgId)
  {
    LastTxnId = string.IsNullOrWhiteSpace(txnId) ? null : txnId.Trim();
    LastMsgId = string.IsNullOrWhiteSpace(msgId) ? null : msgId.Trim();
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void SetCode(
    string codeHash,
    DateTime expiresAtUtc,
    DateTime resendAvailableAtUtc,
    int attemptsRemaining)
  {
    if (Status != SmsVerificationStatus.Pending)
      throw new DomainException("Cannot refresh code for a non-pending session.");

    if (string.IsNullOrWhiteSpace(codeHash))
      throw new DomainArgumentException("CodeHash can't be null or whitespace.");

    if (attemptsRemaining <= 0)
      throw new DomainArgumentException("AttemptsRemaining must be greater than zero.");

    CodeHash = codeHash.Trim();
    AttemptsRemaining = attemptsRemaining;
    ExpiresAtUtc = DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc);
    ResendAvailableAtUtc = DateTime.SpecifyKind(resendAvailableAtUtc, DateTimeKind.Utc);
    FailureReason = null;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void UseResend()
  {
    if (Status != SmsVerificationStatus.Pending)
      throw new DomainException("Cannot use resend for a non-pending session.");

    if (ResendsRemaining <= 0)
      throw new DomainException("Resend limit is exceeded.");

    ResendsRemaining--;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void ConsumeAttempt()
  {
    if (Status != SmsVerificationStatus.Pending)
      throw new DomainException("Cannot consume attempt for a non-pending session.");

    if (AttemptsRemaining <= 0)
      throw new DomainException("Attempts are exhausted.");

    AttemptsRemaining--;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void MarkVerified(DateTime verifiedAtUtc)
  {
    if (Status != SmsVerificationStatus.Pending)
      throw new DomainException("Cannot verify a non-pending session.");

    Status = SmsVerificationStatus.Verified;
    VerifiedAtUtc = DateTime.SpecifyKind(verifiedAtUtc, DateTimeKind.Utc);
    FailureReason = null;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void MarkFailed(string reason)
  {
    if (Status != SmsVerificationStatus.Pending)
      throw new DomainException("Cannot fail a non-pending session.");

    Status = SmsVerificationStatus.Failed;
    FailureReason = string.IsNullOrWhiteSpace(reason) ? "failed" : reason.Trim();
    UpdatedAtUtc = DateTime.UtcNow;
  }
}
