namespace Yalla.Domain.Enums;

/// <summary>
/// Pharmacist's stated reason for declining to decode a prescription.
/// Captured on the row alongside <c>DecodeFailedAtUtc</c> +
/// <c>DecodeFailedByPharmacistId</c>. The two reasons trigger
/// different downstream effects (see <c>PrescriptionService.MarkDecodeFailedAsync</c>):
/// </summary>
public enum PrescriptionDecodeFailureReason
{
  /// <summary>"Bad photo" — the next prescription submission by this
  /// client is free (Client.HasFreePrescriptionCredit set to true).
  /// No refund is processed because the service was technically
  /// rendered, the client is just compensated for the wasted attempt
  /// caused by an upload they could have done better.</summary>
  PoorImageQuality = 1,

  /// <summary>"Unreadable handwriting" — money goes back to the
  /// client physically. A PendingRefund row is created for the
  /// SuperAdmin to process; no automation here on purpose
  /// (provider-specific reversal flows differ).</summary>
  IllegibleHandwriting = 2
}
