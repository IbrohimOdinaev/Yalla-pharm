using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Infrastructure.Telegram;

namespace Api.Controllers;

[ApiController]
[Route("api/telegram/superadmin-bot")]
public sealed class SuperAdminTelegramBotWebhookController : ControllerBase
{
  private readonly SuperAdminTelegramBotUpdateHandler _handler;
  private readonly SuperAdminTelegramNotificationOptions _options;
  private readonly ILogger<SuperAdminTelegramBotWebhookController> _logger;

  public SuperAdminTelegramBotWebhookController(
    SuperAdminTelegramBotUpdateHandler handler,
    IOptions<SuperAdminTelegramNotificationOptions> options,
    ILogger<SuperAdminTelegramBotWebhookController> logger)
  {
    _handler = handler;
    _options = options.Value;
    _logger = logger;
  }

  [HttpPost("webhook")]
  [AllowAnonymous]
  public async Task<IActionResult> Webhook(
    [FromBody] TelegramUpdate update,
    [FromHeader(Name = "X-Telegram-Bot-Api-Secret-Token")] string? secretToken,
    CancellationToken cancellationToken)
  {
    if (string.IsNullOrEmpty(_options.WebhookSecretToken))
    {
      _logger.LogWarning("SuperAdmin Telegram webhook called but WebhookSecretToken is not configured. Rejecting.");
      return Forbid();
    }

    if (!string.Equals(secretToken, _options.WebhookSecretToken, StringComparison.Ordinal))
    {
      _logger.LogWarning("SuperAdmin Telegram webhook called with invalid secret token.");
      return Forbid();
    }

    if (update is null)
      return Ok();

    await _handler.HandleAsync(update, cancellationToken);
    return Ok();
  }
}
