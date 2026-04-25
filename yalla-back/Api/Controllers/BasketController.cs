using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/basket")]
[Authorize(Roles = nameof(Role.Client))]
public sealed class BasketController : ControllerBase
{
  private readonly IClientService _clientService;

  public BasketController(IClientService clientService)
  {
    _clientService = clientService;
  }

  [HttpGet]
  public async Task<IActionResult> Get(CancellationToken cancellationToken)
  {
    var response = await _clientService.GetBasketAsync(new GetBasketRequest
    {
      ClientId = User.GetRequiredUserId()
    }, cancellationToken);

    return Ok(response);
  }

  [HttpPost("items")]
  public async Task<IActionResult> AddItem(
    [FromBody] AddProductToBasketRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var scopedRequest = new AddProductToBasketRequest
    {
      ClientId = currentUserId,
      MedicineId = request.MedicineId,
      Quantity = request.Quantity
    };

    var response = await _clientService.AddProductToBasketAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPatch("items/quantity")]
  public async Task<IActionResult> UpdateQuantity(
    [FromBody] UpdateBasketPositionQuantityRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var scopedRequest = new UpdateBasketPositionQuantityRequest
    {
      ClientId = currentUserId,
      PositionId = request.PositionId,
      Quantity = request.Quantity
    };

    var response = await _clientService.UpdateBasketPositionQuantityAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpDelete("items")]
  public async Task<IActionResult> RemoveItem(
    [FromBody] RemoveProductFromBasketRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var scopedRequest = new RemoveProductFromBasketRequest
    {
      ClientId = currentUserId,
      PositionId = request.PositionId
    };

    var response = await _clientService.RemoveProductFromBasketAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpDelete]
  public async Task<IActionResult> Clear(
    [FromBody] ClearBasketRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var scopedRequest = new ClearBasketRequest
    {
      ClientId = currentUserId
    };

    var response = await _clientService.ClearBasketAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  /// <summary>
  /// Computes pharmacy options (per-pharmacy totals, coverage, availability) for an anonymous
  /// client-supplied cart. Lets the guest UI share the authenticated "от X TJS" best-price pill.
  /// </summary>
  [HttpPost("guest-preview")]
  [AllowAnonymous]
  public async Task<IActionResult> GuestPreview(
    [FromBody] GuestBasketPreviewRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.PreviewGuestBasketAsync(request, cancellationToken);
    return Ok(response);
  }
}
