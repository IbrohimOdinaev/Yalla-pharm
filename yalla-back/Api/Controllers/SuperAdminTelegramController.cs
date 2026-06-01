using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/superadmin/telegram")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class SuperAdminTelegramController : ControllerBase
{
  private readonly ISuperAdminTelegramNotificationService _telegramNotificationService;

  public SuperAdminTelegramController(ISuperAdminTelegramNotificationService telegramNotificationService)
  {
    ArgumentNullException.ThrowIfNull(telegramNotificationService);
    _telegramNotificationService = telegramNotificationService;
  }

  [HttpGet("recipients")]
  public async Task<IActionResult> GetRecipients(CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _telegramNotificationService.GetRecipientsAsync(superAdminId, cancellationToken);
    return Ok(response);
  }

  [HttpPost("link/start")]
  public async Task<IActionResult> StartLink(CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _telegramNotificationService.StartLinkAsync(superAdminId, cancellationToken);
    return Ok(response);
  }

  [HttpGet("link/poll")]
  public async Task<IActionResult> PollLink(
    [FromQuery] string nonce,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _telegramNotificationService.PollAsync(superAdminId, nonce, cancellationToken);
    return Ok(response);
  }

  [HttpPost("link/complete")]
  public async Task<IActionResult> CompleteLink(
    [FromBody] CompleteTelegramAuthRequest request,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _telegramNotificationService.CompleteLinkAsync(
      superAdminId,
      request.Nonce,
      cancellationToken);
    return Ok(response);
  }

  [HttpDelete("recipients/{recipientId:guid}")]
  public async Task<IActionResult> DeleteRecipient(
    Guid recipientId,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    await _telegramNotificationService.DeleteRecipientAsync(superAdminId, recipientId, cancellationToken);
    return NoContent();
  }
}
