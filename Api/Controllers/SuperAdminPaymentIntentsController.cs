using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/superadmin/payment-intents")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class SuperAdminPaymentIntentsController : ControllerBase
{
  private readonly IPaymentIntentService _paymentIntentService;

  public SuperAdminPaymentIntentsController(IPaymentIntentService paymentIntentService)
  {
    _paymentIntentService = paymentIntentService;
  }

  [HttpGet]
  public async Task<IActionResult> GetAll(
    [FromQuery] PaymentIntentState[]? states,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 50,
    CancellationToken cancellationToken = default)
  {
    var response = await _paymentIntentService.GetForSuperAdminAsync(new GetSuperAdminPaymentIntentsRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      States = states ?? [],
      Page = page,
      PageSize = pageSize
    }, cancellationToken);

    return Ok(response);
  }

  [HttpGet("{paymentIntentId:guid}")]
  public async Task<IActionResult> GetById(Guid paymentIntentId, CancellationToken cancellationToken)
  {
    var response = await _paymentIntentService.GetForSuperAdminAsync(new GetSuperAdminPaymentIntentByIdRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      PaymentIntentId = paymentIntentId
    }, cancellationToken);

    return Ok(response);
  }

  [HttpPost("{paymentIntentId:guid}/confirm")]
  public async Task<IActionResult> Confirm(Guid paymentIntentId, CancellationToken cancellationToken)
  {
    var response = await _paymentIntentService.ConfirmBySuperAdminAsync(new ConfirmPaymentIntentBySuperAdminRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      PaymentIntentId = paymentIntentId
    }, cancellationToken);

    return Ok(response);
  }

  [HttpPost("{paymentIntentId:guid}/reject")]
  public async Task<IActionResult> Reject(
    Guid paymentIntentId,
    [FromBody] RejectPaymentIntentBody request,
    CancellationToken cancellationToken)
  {
    var response = await _paymentIntentService.RejectBySuperAdminAsync(new RejectPaymentIntentBySuperAdminRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      PaymentIntentId = paymentIntentId,
      Reason = request.Reason
    }, cancellationToken);

    return Ok(response);
  }

  public sealed class RejectPaymentIntentBody
  {
    public string Reason { get; init; } = string.Empty;
  }
}
