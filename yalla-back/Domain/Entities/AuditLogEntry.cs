using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// Immutable record of a sensitive action — written transactionally
/// alongside the action it describes. Used for compliance review, post-
/// incident forensics, and correlation of a single HTTP request's
/// downstream effects via <see cref="CorrelationId"/>.
///
/// Rows are append-only; there is no update path. Retention/cleanup is
/// expected to live outside the domain (e.g. a partitioned table + cron
/// pruner) — the entity itself doesn't carry an "expires_at".
/// </summary>
public class AuditLogEntry
{
  /// <summary>Maximum bytes serialised JSON payload may occupy. Larger
  /// payloads are truncated with a marker at write time so a single row
  /// can't blow up the jsonb column or screw with retrieval queries.</summary>
  public const int MaxPayloadSizeBytes = 16 * 1024;

  /// <summary>Hard cap on the human-readable summary line.</summary>
  public const int MaxSummaryLength = 500;

  public Guid Id { get; private set; }

  public DateTime OccurredAtUtc { get; private set; }

  /// <summary>User who triggered the action. Null for anonymous events
  /// (failed login before user is resolved, system jobs).</summary>
  public Guid? ActorUserId { get; private set; }

  /// <summary>Role at the moment the action happened — copied here so
  /// future role changes don't rewrite the audit trail.</summary>
  public Role? ActorRole { get; private set; }

  /// <summary>Remote IP of the request, when available. Forwarded
  /// headers are honoured by the middleware before this gets set.</summary>
  public string? ActorIp { get; private set; }

  /// <summary>Logical entity type that was acted on (e.g. "Order",
  /// "Prescription"). Free-form string so we don't have to keep an enum
  /// in lock-step with the domain.</summary>
  public string EntityType { get; private set; } = string.Empty;

  /// <summary>Id of the entity, when applicable. Null for events that
  /// don't bind to a single row (e.g. "ListAccessed").</summary>
  public Guid? EntityId { get; private set; }

  public AuditAction Action { get; private set; }

  /// <summary>One-line human-readable description, ≤ 500 chars.</summary>
  public string Summary { get; private set; } = string.Empty;

  /// <summary>Structured payload — typically a before/after diff or a
  /// snapshot of relevant fields. Serialised JSON; soft-capped to
  /// 16 KB. Stored in a jsonb column for ad-hoc filtering.</summary>
  public string? PayloadJson { get; private set; }

  /// <summary>Groups every audit entry written during a single inbound
  /// HTTP request so we can replay "everything that happened when user
  /// X clicked Y" with a single query.</summary>
  public Guid? CorrelationId { get; private set; }

  private AuditLogEntry() { }

  public AuditLogEntry(
    Guid id,
    DateTime occurredAtUtc,
    Guid? actorUserId,
    Role? actorRole,
    string? actorIp,
    string entityType,
    Guid? entityId,
    AuditAction action,
    string summary,
    string? payloadJson,
    Guid? correlationId)
  {
    if (id == Guid.Empty)
      throw new DomainArgumentException("AuditLogEntry.Id can't be empty.");

    if (string.IsNullOrWhiteSpace(entityType))
      throw new DomainArgumentException("AuditLogEntry.EntityType can't be null or whitespace.");

    if (entityType.Length > 100)
      throw new DomainArgumentException("AuditLogEntry.EntityType is capped at 100 chars.");

    if (string.IsNullOrWhiteSpace(summary))
      throw new DomainArgumentException("AuditLogEntry.Summary can't be null or whitespace.");

    Id = id;
    OccurredAtUtc = occurredAtUtc;
    ActorUserId = actorUserId;
    ActorRole = actorRole;
    ActorIp = string.IsNullOrWhiteSpace(actorIp) ? null : actorIp.Trim();
    EntityType = entityType.Trim();
    EntityId = entityId;
    Action = action;
    Summary = summary.Length > MaxSummaryLength
      ? summary.Substring(0, MaxSummaryLength)
      : summary;
    PayloadJson = payloadJson;
    CorrelationId = correlationId;
  }
}
