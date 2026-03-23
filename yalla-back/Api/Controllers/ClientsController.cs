using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/clients")]
public sealed class ClientsController : ControllerBase
{
  private readonly IClientService _clientService;

  public ClientsController(IClientService clientService)
  {
    _clientService = clientService;
  }

  [HttpPost("register")]
  [AllowAnonymous]
  public async Task<IActionResult> Register(
    [FromBody] RegisterClientRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.RegisterClientAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("register/request")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-request")]
  public async Task<IActionResult> RequestRegistrationVerification(
    [FromBody] RegisterClientRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.RequestClientRegistrationVerificationAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("register/verify")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-verify")]
  public async Task<IActionResult> VerifyRegistration(
    [FromBody] VerifyClientRegistrationRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.VerifyClientRegistrationAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("register/resend")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-resend")]
  public async Task<IActionResult> ResendRegistrationCode(
    [FromBody] ResendClientRegistrationRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.ResendClientRegistrationVerificationAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("me")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> GetMe(CancellationToken cancellationToken)
  {
    var response = await _clientService.GetClientByIdAsync(new GetClientByIdRequest
    {
      ClientId = User.GetRequiredUserId()
    }, cancellationToken);

    return Ok(response);
  }

  [HttpGet("{clientId:guid}")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetById(
    Guid clientId,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.GetClientByIdAsync(new GetClientByIdRequest
    {
      ClientId = clientId
    }, cancellationToken);

    return Ok(response);
  }

  [HttpPut("me")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> UpdateMe(
    [FromBody] UpdateMyClientProfileRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.UpdateClientAsync(new UpdateClientRequest
    {
      ClientId = User.GetRequiredUserId(),
      Name = request.Name,
      PhoneNumber = request.PhoneNumber
    }, cancellationToken);

    return Ok(response);
  }

  [HttpDelete("me")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> DeleteMe(CancellationToken cancellationToken)
  {
    var response = await _clientService.DeleteClientAsync(new DeleteClientRequest
    {
      ClientId = User.GetRequiredUserId()
    }, cancellationToken);

    return Ok(response);
  }

  [HttpPut]
  [Authorize(Roles = $"{nameof(Role.Client)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> Update(
    [FromBody] UpdateClientRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var currentRole = User.GetRequiredRole();
    if (currentRole == Role.Client && request.ClientId != currentUserId)
      return Forbid();

    var response = await _clientService.UpdateClientAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpDelete]
  [Authorize(Roles = $"{nameof(Role.Client)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> Delete(
    [FromBody] DeleteClientRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var currentRole = User.GetRequiredRole();
    if (currentRole == Role.Client && request.ClientId != currentUserId)
      return Forbid();

    var response = await _clientService.DeleteClientAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetAll(
    [FromQuery] GetAllClientsRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.GetAllClientsAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("with-basket")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetAllWithBasket(
    [FromQuery] GetAllClientsRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.GetAllClientsWithBasketAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("by-phone")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetByPhone(
    [FromQuery] GetClientByPhoneNumberRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _clientService.GetClientByPhoneNumberAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("checkout/preview")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> PreviewCheckout(
    [FromBody] CheckoutBasketRequest request,
    CancellationToken cancellationToken)
  {
    var currentUserId = User.GetRequiredUserId();
    var scopedRequest = new CheckoutBasketRequest
    {
      ClientId = currentUserId,
      PharmacyId = request.PharmacyId,
      IsPickup = request.IsPickup,
      DeliveryAddress = request.DeliveryAddress,
      IdempotencyKey = request.IdempotencyKey,
      IgnoredPositionIds = request.IgnoredPositionIds
    };

    var response = await _clientService.PreviewCheckoutAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("checkout")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> Checkout(
    [FromBody] CheckoutBasketRequest request,
    CancellationToken cancellationToken)
  {
    var idempotencyKey = request.IdempotencyKey;
    if (string.IsNullOrWhiteSpace(idempotencyKey)
      && Request.Headers.TryGetValue("Idempotency-Key", out var idempotencyHeader))
    {
      idempotencyKey = idempotencyHeader.ToString();
    }

    if (string.IsNullOrWhiteSpace(idempotencyKey))
    {
      return BadRequest(new
      {
        message = "IdempotencyKey is required. Provide body.IdempotencyKey or Idempotency-Key header."
      });
    }

    var currentUserId = User.GetRequiredUserId();
    var scopedRequest = new CheckoutBasketRequest
    {
      ClientId = currentUserId,
      PharmacyId = request.PharmacyId,
      IsPickup = request.IsPickup,
      DeliveryAddress = request.DeliveryAddress,
      IdempotencyKey = idempotencyKey,
      IgnoredPositionIds = request.IgnoredPositionIds
    };

    var response = await _clientService.CheckoutBasketAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }
}
