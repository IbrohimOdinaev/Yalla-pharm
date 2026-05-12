using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/refunds")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class PendingRefundsController : ControllerBase
{
  private readonly IPendingRefundService _service;

  public PendingRefundsController(IPendingRefundService service)
  {
    _service = service;
  }

  /// <summary>
  /// SuperAdmin's to-do list: every refund row that hasn't been
  /// physically settled yet. Oldest first.
  /// </summary>
  [HttpGet("pending")]
  public async Task<IActionResult> GetPending(CancellationToken cancellationToken)
  {
    var refunds = await _service.GetPendingAsync(cancellationToken);
    return Ok(refunds);
  }

  /// <summary>
  /// Record that the SuperAdmin physically returned the money
  /// (bank transfer, cash, etc.). Body { comment } captures the
  /// transfer reference for reconciliation.
  /// </summary>
  [HttpPost("{refundId:guid}/mark-processed")]
  public async Task<IActionResult> MarkProcessed(
    Guid refundId,
    [FromBody] MarkRefundProcessedRequest request,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _service.MarkProcessedAsync(
      refundId, superAdminId, request?.Comment, cancellationToken);
    return Ok(response);
  }
}

public sealed class MarkRefundProcessedRequest
{
  /// <summary>Bank reference / cash receipt id — required for
  /// reconciliation. Capped at 500 chars by the domain.</summary>
  public string? Comment { get; init; }
}
