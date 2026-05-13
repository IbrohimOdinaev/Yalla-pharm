namespace Yalla.Domain.Enums;

/// <summary>
/// Reason a prescription request landed in <see cref="PrescriptionStatus.Cancelled"/>.
/// Captured on the row alongside <c>CancelledAtUtc</c> so the client UI can
/// render a meaningful message and the audit log can attribute the
/// terminal transition. Pre-existing rows stay null — back-fill is not
/// attempted because we don't know retroactively why they were cancelled.
/// </summary>
public enum PrescriptionCancellationReason
{
  /// <summary>Client explicitly cancelled via the API.</summary>
  ClientCancelled = 1,

  /// <summary>Auto-cancelled because 24h elapsed without payment
  /// confirmation (<see cref="Yalla.Infrastructure.Payments.PrescriptionPaymentTimeoutHostedService"/>).</summary>
  PaymentTimeout = 2,

  /// <summary>Pharmacist explicitly marked decoding as failed
  /// (illegible handwriting, blurry photos, etc.). See Task #1 of
  /// the refund flow PR.</summary>
  PharmacistDecodeFailed = 3
}
