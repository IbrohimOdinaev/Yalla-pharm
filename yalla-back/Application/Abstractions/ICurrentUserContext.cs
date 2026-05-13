using Yalla.Domain.Enums;

namespace Yalla.Application.Abstractions;

/// <summary>
/// Read-only snapshot of "who's making this call right now" — surfaces
/// the authenticated user (when any), their role, the source IP, and a
/// per-request correlation id. Implemented in the Api layer over
/// HttpContext; consumed by Infrastructure (AuditLogger) without
/// dragging an HTTP dependency into Domain/Application/Infrastructure.
///
/// All properties may be null (anonymous request, background job, etc.).
/// </summary>
public interface ICurrentUserContext
{
  Guid? UserId { get; }
  Role? Role { get; }
  /// <summary>Source IP — honours X-Forwarded-For first-hop when behind
  /// a proxy.</summary>
  string? Ip { get; }
  /// <summary>Per-request correlation id set by the middleware. Lets
  /// downstream audit entries from the same HTTP request be grouped
  /// together.</summary>
  Guid? CorrelationId { get; }
}
