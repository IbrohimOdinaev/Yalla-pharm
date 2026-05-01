using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/refund-requests")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class RefundRequestsController : ControllerBase
{
  private readonly IRefundRequestService _refundRequestService;

  public RefundRequestsController(IRefundRequestService refundRequestService)
  {
    _refundRequestService = refundRequestService;
  }

  [HttpGet]
  public async Task<IActionResult> GetList(
    [FromQuery] GetRefundRequestsRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _refundRequestService.GetRefundRequestsAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("initiate")]
  public async Task<IActionResult> InitiateBySuperAdmin(
    [FromBody] InitiateRefundBySuperAdminRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new InitiateRefundBySuperAdminRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      RefundRequestId = request.RefundRequestId
    };

    var response = await _refundRequestService.InitiateRefundBySuperAdminAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("complete")]
  public async Task<IActionResult> CompleteBySuperAdmin(
    [FromBody] CompleteRefundBySuperAdminRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new CompleteRefundBySuperAdminRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      RefundRequestId = request.RefundRequestId
    };

    var response = await _refundRequestService.CompleteRefundBySuperAdminAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }
}
