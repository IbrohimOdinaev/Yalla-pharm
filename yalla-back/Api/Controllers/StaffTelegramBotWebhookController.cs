using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Infrastructure.Telegram;

namespace Api.Controllers;

[ApiController]
[Route("api/telegram/staff-bot")]
public sealed class StaffTelegramBotWebhookController : ControllerBase
{
  private readonly StaffTelegramBotUpdateHandler _handler;
  private readonly StaffTelegramNotificationOptions _options;
  private readonly ILogger<StaffTelegramBotWebhookController> _logger;

  public StaffTelegramBotWebhookController(
    StaffTelegramBotUpdateHandler handler,
    IOptions<StaffTelegramNotificationOptions> options,
    ILogger<StaffTelegramBotWebhookController> logger)
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
      _logger.LogWarning("Staff Telegram webhook called but WebhookSecretToken is not configured. Rejecting.");
      return Forbid();
    }

    if (!string.Equals(secretToken, _options.WebhookSecretToken, StringComparison.Ordinal))
    {
      _logger.LogWarning("Staff Telegram webhook called with invalid secret token.");
      return Forbid();
    }

    if (update is null)
      return Ok();

    await _handler.HandleAsync(update, cancellationToken);
    return Ok();
  }
}
