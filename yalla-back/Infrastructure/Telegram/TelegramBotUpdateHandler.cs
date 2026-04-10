using Microsoft.Extensions.Logging;
using Yalla.Application.Services;

namespace Yalla.Infrastructure.Telegram;

/// <summary>
/// Routes incoming Telegram updates to <see cref="ITelegramAuthService"/>.
/// Only handles auth-related events (/start auth_* and Confirm/Cancel callbacks);
/// everything else is silently ignored so the bot can keep doing other things.
/// </summary>
public sealed class TelegramBotUpdateHandler
{
  private const string StartCommandPrefix = "/start ";
  private const string AuthDeeplinkPrefix = "auth_";
  private const string ConfirmCallbackPrefix = "tgauth:cnf:";
  private const string CancelCallbackPrefix = "tgauth:cnc:";

  private readonly ITelegramAuthService _authService;
  private readonly ILogger<TelegramBotUpdateHandler> _logger;

  public TelegramBotUpdateHandler(
    ITelegramAuthService authService,
    ILogger<TelegramBotUpdateHandler> logger)
  {
    ArgumentNullException.ThrowIfNull(authService);
    ArgumentNullException.ThrowIfNull(logger);

    _authService = authService;
    _logger = logger;
  }

  public async Task HandleAsync(TelegramUpdate update, CancellationToken cancellationToken = default)
  {
    if (update is null) return;

    try
    {
      if (update.Message is { Text: not null } message)
      {
        await HandleMessageAsync(message, cancellationToken);
        return;
      }

      if (update.CallbackQuery is { Data: not null } callback)
      {
        await HandleCallbackAsync(callback, cancellationToken);
        return;
      }
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Telegram bot update handler crashed. UpdateId={UpdateId}", update.UpdateId);
      // Swallow — Telegram retries failed webhooks indefinitely otherwise.
    }
  }

  private async Task HandleMessageAsync(TelegramMessage message, CancellationToken cancellationToken)
  {
    var text = message.Text!.Trim();
    if (!text.StartsWith(StartCommandPrefix, StringComparison.Ordinal)) return;

    var arg = text[StartCommandPrefix.Length..].Trim();
    if (!arg.StartsWith(AuthDeeplinkPrefix, StringComparison.Ordinal)) return;

    var nonce = arg[AuthDeeplinkPrefix.Length..];
    if (string.IsNullOrWhiteSpace(nonce)) return;
    if (message.Chat is null || message.From is null) return;

    await _authService.HandleStartCommandAsync(
      nonce,
      message.Chat.Id,
      message.From.Id,
      message.From.Username,
      message.From.FirstName,
      message.From.LastName,
      cancellationToken);
  }

  private async Task HandleCallbackAsync(TelegramCallbackQuery callback, CancellationToken cancellationToken)
  {
    var data = callback.Data!;
    var msg = callback.Message;
    if (msg?.Chat is null) return;
    if (callback.From is null) return;

    if (data.StartsWith(ConfirmCallbackPrefix, StringComparison.Ordinal))
    {
      var nonce = data[ConfirmCallbackPrefix.Length..];
      if (string.IsNullOrWhiteSpace(nonce)) return;
      await _authService.HandleConfirmCallbackAsync(
        nonce,
        callback.Id,
        msg.Chat.Id,
        msg.MessageId,
        callback.From.Id,
        callback.From.Username,
        callback.From.FirstName,
        callback.From.LastName,
        cancellationToken);
      return;
    }

    if (data.StartsWith(CancelCallbackPrefix, StringComparison.Ordinal))
    {
      var nonce = data[CancelCallbackPrefix.Length..];
      if (string.IsNullOrWhiteSpace(nonce)) return;
      await _authService.HandleCancelCallbackAsync(
        nonce,
        callback.Id,
        msg.Chat.Id,
        msg.MessageId,
        cancellationToken);
    }
  }
}
