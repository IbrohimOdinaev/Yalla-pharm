using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// SuperAdmin's to-do list of money that needs to be returned to a
/// client. Currently fed by prescription decode-failures with
/// reason=IllegibleHandwriting; the actual refund happens out-of-band
/// (bank transfer, cash) and SuperAdmin marks the row processed.
///
/// Append-once: <see cref="MarkProcessed"/> is the only mutation, and
/// it's a one-way door — re-processing is rejected so the audit row
/// reflects a real human action exactly once.
/// </summary>
public sealed class PendingRefund
{
  public const int MaxReasonLength = 500;
  public const int MaxCommentLength = 500;

  public Guid Id { get; private set; }
  public Guid ClientId { get; private set; }
  public Guid PrescriptionId { get; private set; }
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = string.Empty;
  /// <summary>Free-form reason captured at creation time
  /// (e.g. "Pharmacist marked decode as illegible handwriting").
  /// Auto-truncated to 500 chars.</summary>
  public string Reason { get; private set; } = string.Empty;
  public DateTime CreatedAtUtc { get; private set; }

  public DateTime? ProcessedAtUtc { get; private set; }
  public Guid? ProcessedByUserId { get; private set; }
  /// <summary>SuperAdmin's comment on the actual transfer
  /// (bank reference, cash receipt id, etc.) — required for
  /// reconciliation later. Capped at 500 chars.</summary>
  public string? SuperAdminComment { get; private set; }

  private PendingRefund() { }

  public PendingRefund(
    Guid clientId,
    Guid prescriptionId,
    decimal amount,
    string currency,
    string reason)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");
    if (prescriptionId == Guid.Empty)
      throw new DomainArgumentException("PrescriptionId can't be empty.");
    if (amount <= 0)
      throw new DomainArgumentException("Amount must be greater than zero.");
    if (string.IsNullOrWhiteSpace(currency))
      throw new DomainArgumentException("Currency can't be null or whitespace.");
    if (string.IsNullOrWhiteSpace(reason))
      throw new DomainArgumentException("Reason can't be null or whitespace.");

    Id = Guid.NewGuid();
    ClientId = clientId;
    PrescriptionId = prescriptionId;
    Amount = amount;
    Currency = currency.Trim().ToUpperInvariant();
    Reason = reason.Trim().Length > MaxReasonLength
      ? reason.Trim()[..MaxReasonLength]
      : reason.Trim();
    CreatedAtUtc = DateTime.UtcNow;
  }

  public void MarkProcessed(Guid processedByUserId, string? comment)
  {
    if (processedByUserId == Guid.Empty)
      throw new DomainArgumentException("ProcessedByUserId can't be empty.");

    if (ProcessedAtUtc.HasValue)
      throw new DomainException("PendingRefund is already processed.");

    ProcessedByUserId = processedByUserId;
    ProcessedAtUtc = DateTime.UtcNow;
    SuperAdminComment = string.IsNullOrWhiteSpace(comment)
      ? null
      : comment.Trim().Length > MaxCommentLength
        ? comment.Trim()[..MaxCommentLength]
        : comment.Trim();
  }
}
