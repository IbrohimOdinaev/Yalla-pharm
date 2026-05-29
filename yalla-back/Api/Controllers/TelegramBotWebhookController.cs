using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Infrastructure.Telegram;

namespace Api.Controllers;

[ApiController]
[Route("api/telegram/bot")]
public sealed class TelegramBotWebhookController : ControllerBase
{
  private readonly TelegramBotUpdateHandler _handler;
  private readonly TelegramAuthOptions _options;
  private readonly ILogger<TelegramBotWebhookController> _logger;

  public TelegramBotWebhookController(
    TelegramBotUpdateHandler handler,
    IOptions<TelegramAuthOptions> options,
    ILogger<TelegramBotWebhookController> logger)
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
      _logger.LogWarning("Telegram webhook called but WebhookSecretToken is not configured. Rejecting.");
      return Forbid();
    }

    if (!string.Equals(secretToken, _options.WebhookSecretToken, StringComparison.Ordinal))
    {
      _logger.LogWarning("Telegram webhook called with invalid secret token.");
      return Forbid();
    }

    if (update is null)
    {
      _logger.LogInformation("Telegram webhook received an empty update.");
      return Ok();
    }

    _logger.LogInformation(
      "Telegram webhook received. UpdateId={UpdateId}, HasMessage={HasMessage}, HasCallback={HasCallback}",
      update.UpdateId,
      update.Message is not null,
      update.CallbackQuery is not null);

    await _handler.HandleAsync(update, cancellationToken);
    return Ok();
  }
}
