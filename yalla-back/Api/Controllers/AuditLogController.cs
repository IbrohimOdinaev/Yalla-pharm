using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/audit-log")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class AuditLogController : ControllerBase
{
  private readonly IAuditLogService _service;

  public AuditLogController(IAuditLogService service)
  {
    _service = service;
  }

  /// <summary>
  /// Paginated list of audit entries with optional filters
  /// (entity_type/entity_id, actor_user_id, action, correlation_id,
  /// time range). Only SuperAdmin can read — audit must not be visible
  /// to the actors it tracks.
  /// </summary>
  [HttpGet]
  public async Task<IActionResult> Query(
    [FromQuery] GetAuditLogRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _service.QueryAsync(request, cancellationToken);
    return Ok(response);
  }
}
