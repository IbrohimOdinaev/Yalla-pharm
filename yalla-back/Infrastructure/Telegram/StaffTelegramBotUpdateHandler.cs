using Microsoft.Extensions.Logging;
using Yalla.Application.Services;

namespace Yalla.Infrastructure.Telegram;

public sealed class StaffTelegramBotUpdateHandler
{
  private const string StartCommandPrefix = "/start ";
  private const string StaffNotifyDeeplinkPrefix = "staff_notify_";
  private const string ConfirmCallbackPrefix = "tgstaff:cnf:";
  private const string CancelCallbackPrefix = "tgstaff:cnc:";

  private readonly IStaffTelegramNotificationService _service;
  private readonly ILogger<StaffTelegramBotUpdateHandler> _logger;

  public StaffTelegramBotUpdateHandler(
    IStaffTelegramNotificationService service,
    ILogger<StaffTelegramBotUpdateHandler> logger)
  {
    ArgumentNullException.ThrowIfNull(service);
    ArgumentNullException.ThrowIfNull(logger);

    _service = service;
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
    catch (Exception exception)
    {
      _logger.LogError(exception, "Staff Telegram bot update handler crashed. UpdateId={UpdateId}", update.UpdateId);
    }
  }

  private async Task HandleMessageAsync(TelegramMessage message, CancellationToken cancellationToken)
  {
    var text = message.Text!.Trim();
    if (!text.StartsWith("/start", StringComparison.Ordinal))
      return;

    if (!text.StartsWith(StartCommandPrefix, StringComparison.Ordinal))
    {
      _logger.LogInformation("Staff Telegram bot received /start without payload.");
      return;
    }

    var arg = text[StartCommandPrefix.Length..].Trim();
    if (!arg.StartsWith(StaffNotifyDeeplinkPrefix, StringComparison.Ordinal))
    {
      _logger.LogInformation("Staff Telegram bot received /start with unsupported payload.");
      return;
    }

    var nonce = arg[StaffNotifyDeeplinkPrefix.Length..];
    if (string.IsNullOrWhiteSpace(nonce))
      return;

    if (message.Chat is null || message.From is null)
    {
      _logger.LogWarning(
        "Staff Telegram bot received link start without chat/from. HasChat={HasChat}, HasFrom={HasFrom}",
        message.Chat is not null,
        message.From is not null);
      return;
    }

    await _service.HandleStartCommandAsync(
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
    if (msg?.Chat is null || callback.From is null)
      return;

    if (data.StartsWith(ConfirmCallbackPrefix, StringComparison.Ordinal))
    {
      var nonce = data[ConfirmCallbackPrefix.Length..];
      if (string.IsNullOrWhiteSpace(nonce)) return;

      await _service.HandleConfirmCallbackAsync(
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

      await _service.HandleCancelCallbackAsync(
        nonce,
        callback.Id,
        msg.Chat.Id,
        msg.MessageId,
        cancellationToken);
    }
  }
}
