using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/clients/payment-intents")]
[Authorize(Roles = nameof(Role.Client))]
public sealed class ClientPaymentIntentsController : ControllerBase
{
  private readonly IPaymentIntentService _paymentIntentService;

  public ClientPaymentIntentsController(IPaymentIntentService paymentIntentService)
  {
    _paymentIntentService = paymentIntentService;
  }

  [HttpGet("{paymentIntentId:guid}")]
  public async Task<IActionResult> GetById(Guid paymentIntentId, CancellationToken cancellationToken)
  {
    var response = await _paymentIntentService.GetForClientAsync(new GetClientPaymentIntentByIdRequest
    {
      ClientId = User.GetRequiredUserId(),
      PaymentIntentId = paymentIntentId
    }, cancellationToken);

    return Ok(response);
  }
}
