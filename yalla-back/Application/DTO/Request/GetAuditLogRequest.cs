using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

/// <summary>
/// Query parameters for <c>GET /api/audit-log</c>. All filters are
/// optional and AND-combined. Pagination caps at 200 rows/page.
/// </summary>
public sealed class GetAuditLogRequest
{
  public string? EntityType { get; init; }
  public Guid? EntityId { get; init; }
  public Guid? ActorUserId { get; init; }
  public AuditAction? Action { get; init; }
  public Guid? CorrelationId { get; init; }
  public DateTime? FromUtc { get; init; }
  public DateTime? ToUtc { get; init; }
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
