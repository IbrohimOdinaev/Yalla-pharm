namespace Yalla.Domain.Enums;

/// <summary>
/// High-level audit action types written into the audit_log table. Kept
/// deliberately coarse — the per-action specifics live in
/// <see cref="Yalla.Domain.Entities.AuditLogEntry.PayloadJson"/>. Adding
/// a new variant requires a thoughtful pass through call sites to keep
/// the taxonomy meaningful; prefer reusing an existing one when in doubt.
/// </summary>
public enum AuditAction
{
  /// <summary>Resource created (entity inserted).</summary>
  Created = 0,

  /// <summary>Resource mutated (one or more fields changed).</summary>
  Updated = 1,

  /// <summary>Resource soft- or hard-deleted.</summary>
  Deleted = 2,

  /// <summary>Workflow status transition (Order, Prescription, etc.).</summary>
  StatusChanged = 3,

  /// <summary>Successful authentication / token issued.</summary>
  LoginSucceeded = 10,

  /// <summary>Failed authentication attempt (wrong password, locked, etc.).</summary>
  LoginFailed = 11,

  /// <summary>Refresh token rotated normally.</summary>
  TokenRotated = 12,

  /// <summary>Refresh token reuse detected — all sessions revoked.</summary>
  TokenCompromised = 13,

  /// <summary>User logged out (current session or all sessions).</summary>
  LoggedOut = 14,

  /// <summary>Manual payment confirmed by SuperAdmin.</summary>
  PaymentConfirmed = 20,

  /// <summary>Payment rejected by SuperAdmin.</summary>
  PaymentRejected = 21,

  /// <summary>Payment refunded.</summary>
  PaymentRefunded = 22,

  /// <summary>Order rejected positions (partial fulfilment).</summary>
  PositionsRejected = 30,

  /// <summary>Pharmacist took a prescription into review.</summary>
  PrescriptionAssigned = 40,

  /// <summary>Pharmacist submitted the decoded checklist.</summary>
  PrescriptionDecoded = 41
}
