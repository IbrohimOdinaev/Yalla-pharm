namespace Yalla.Application.Common;

/// <summary>
/// Configuration for the prescription payment-timeout worker. Bound
/// from the <c>Prescription</c> section in appsettings.json.
/// </summary>
public sealed class PrescriptionTimeoutOptions
{
  public const string SectionName = "Prescription";

  /// <summary>How long an unpaid prescription is allowed to live
  /// before being auto-cancelled. Default 24 hours per spec.</summary>
  public int PaymentTimeoutHours { get; set; } = 24;

  /// <summary>How often the worker scans for expired prescriptions.
  /// Default 10 minutes — fine-grained enough to keep stale rows out
  /// of "active" lists without DB-hammering.</summary>
  public int PaymentTimeoutCheckIntervalMinutes { get; set; } = 10;
}
