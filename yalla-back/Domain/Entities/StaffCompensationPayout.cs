using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class StaffCompensationPayout
{
  public const int MaxNoteLength = 512;

  public Guid Id { get; private set; }
  public Guid StaffUserId { get; private set; }
  public Role StaffRole { get; private set; }
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = "TJS";
  public StaffPayoutMethod Method { get; private set; }
  public string? ReceiptImageKey { get; private set; }
  public string? Note { get; private set; }
  public DateTime PaidAtUtc { get; private set; }
  public Guid PaidBySuperAdminId { get; private set; }

  private StaffCompensationPayout() { }

  public StaffCompensationPayout(
    Guid staffUserId,
    Role staffRole,
    decimal amount,
    StaffPayoutMethod method,
    Guid paidBySuperAdminId,
    string currency = "TJS",
    string? receiptImageKey = null,
    string? note = null)
  {
    if (staffUserId == Guid.Empty)
      throw new DomainArgumentException("StaffUserId can't be empty.");
    if (paidBySuperAdminId == Guid.Empty)
      throw new DomainArgumentException("PaidBySuperAdminId can't be empty.");
    if (staffRole is not Role.Admin and not Role.Pharmacist)
      throw new DomainArgumentException("Staff payout is only supported for Admin and Pharmacist roles.");
    if (amount <= 0)
      throw new DomainArgumentException("Payout amount must be positive.");
    if (method == StaffPayoutMethod.Transfer && string.IsNullOrWhiteSpace(receiptImageKey))
      throw new DomainArgumentException("Transfer payout requires a receipt image.");
    if (note is { Length: > MaxNoteLength })
      throw new DomainArgumentException($"Note can't exceed {MaxNoteLength} characters.");

    Id = Guid.NewGuid();
    StaffUserId = staffUserId;
    StaffRole = staffRole;
    Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    Currency = NormalizeCurrency(currency);
    Method = method;
    ReceiptImageKey = string.IsNullOrWhiteSpace(receiptImageKey) ? null : receiptImageKey.Trim();
    Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    PaidAtUtc = DateTime.UtcNow;
    PaidBySuperAdminId = paidBySuperAdminId;
  }

  private static string NormalizeCurrency(string currency)
  {
    var normalized = string.IsNullOrWhiteSpace(currency) ? "TJS" : currency.Trim().ToUpperInvariant();
    if (normalized.Length is < 3 or > 8)
      throw new DomainArgumentException("Currency must be between 3 and 8 characters.");
    return normalized;
  }
}
