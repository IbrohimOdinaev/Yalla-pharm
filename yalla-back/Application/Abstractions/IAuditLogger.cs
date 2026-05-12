using Yalla.Domain.Enums;

namespace Yalla.Application.Abstractions;

/// <summary>
/// Append-only sink for sensitive-action audit records. Implementations
/// write into the same Unit-of-Work as the calling service so the audit
/// row is committed atomically with the change it describes — no
/// background fire-and-forget, no message broker. If the surrounding
/// transaction rolls back, the audit row rolls back with it; if the row
/// can't be written, the surrounding operation fails.
///
/// Actor identity (user id, role, ip) and correlation id are resolved
/// by the implementation from the current HttpContext — call sites only
/// pass the what/where/why.
/// </summary>
public interface IAuditLogger
{
  /// <summary>
  /// Stage an audit entry against the current DbContext. The actual
  /// INSERT happens on the next <c>SaveChangesAsync()</c> as part of
  /// the surrounding transaction. The optional <paramref name="payload"/>
  /// is serialised to JSON; oversized payloads are truncated with a
  /// marker so a single bad entry can't blow up the jsonb column.
  /// </summary>
  /// <param name="action">High-level action category (Created,
  /// StatusChanged, LoginSucceeded, …).</param>
  /// <param name="entityType">Logical resource name, e.g. "Order",
  /// "Prescription", "User". Free-form string, ≤ 100 chars.</param>
  /// <param name="entityId">Id of the entity acted upon, or null for
  /// actions that don't bind to a single row.</param>
  /// <param name="summary">One-line human-readable description,
  /// ≤ 500 chars (auto-truncated above that). Shown verbatim in the
  /// audit list UI.</param>
  /// <param name="payload">Optional structured payload (typically a
  /// before/after diff or a snapshot dictionary). Serialised to JSON.</param>
  Task LogAsync(
    AuditAction action,
    string entityType,
    Guid? entityId,
    string summary,
    object? payload = null,
    CancellationToken cancellationToken = default);
}
