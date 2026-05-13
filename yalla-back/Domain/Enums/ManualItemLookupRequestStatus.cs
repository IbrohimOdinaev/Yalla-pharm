namespace Yalla.Domain.Enums;

/// <summary>
/// Lifecycle of a pharmacist-initiated lookup for a manual (out-of-catalog)
/// prescription item. Open requests are visible globally to all pharmacy
/// admins. They auto-close when the pharmacist submits the checklist
/// (Prescription transitions InReview → Decoded).
/// </summary>
public enum ManualItemLookupRequestStatus
{
    Open = 0,
    Closed = 1
}
