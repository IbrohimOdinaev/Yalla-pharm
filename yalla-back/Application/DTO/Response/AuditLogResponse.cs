namespace Yalla.Application.DTO.Response;

public sealed class AuditLogPageResponse
{
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyList<AuditLogEntryResponse> Items { get; init; } = Array.Empty<AuditLogEntryResponse>();
}

public sealed class AuditLogEntryResponse
{
  public Guid Id { get; init; }
  public DateTime OccurredAtUtc { get; init; }
  public Guid? ActorUserId { get; init; }
  /// <summary>String form of the role enum at action time
  /// ("Client"/"Admin"/"SuperAdmin"/…); preserved for historic
  /// roles that may have since changed.</summary>
  public string? ActorRole { get; init; }
  public string? ActorIp { get; init; }
  public string EntityType { get; init; } = string.Empty;
  public Guid? EntityId { get; init; }
  public string Action { get; init; } = string.Empty;
  public string Summary { get; init; } = string.Empty;
  /// <summary>JSON payload as a raw string; clients deserialise on
  /// demand. Kept as text so we don't double-parse.</summary>
  public string? PayloadJson { get; init; }
  public Guid? CorrelationId { get; init; }
}
