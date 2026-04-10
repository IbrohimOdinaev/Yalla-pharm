namespace Yalla.Application.Abstractions;

/// <summary>
/// Thin abstraction over the Telegram Bot HTTP API.
/// Only exposes the calls our auth flow needs.
/// </summary>
public interface ITelegramBotApi
{
  /// <summary>Sends a message with two inline buttons (Confirm / Cancel). Returns the sent message id.</summary>
  Task<TelegramSentMessage> SendConfirmationPromptAsync(
    long chatId,
    string text,
    string confirmCallbackData,
    string cancelCallbackData,
    string confirmButtonText,
    string cancelButtonText,
    CancellationToken cancellationToken = default);

  /// <summary>Edits an existing message text and removes its inline keyboard.</summary>
  Task EditMessageTextAsync(
    long chatId,
    int messageId,
    string newText,
    CancellationToken cancellationToken = default);

  /// <summary>Acknowledges a callback query, optionally with a tiny notification text shown to the user.</summary>
  Task AnswerCallbackQueryAsync(
    string callbackQueryId,
    string? text = null,
    bool showAlert = false,
    CancellationToken cancellationToken = default);

  /// <summary>Sends a plain text message.</summary>
  Task SendMessageAsync(
    long chatId,
    string text,
    CancellationToken cancellationToken = default);

  /// <summary>Registers (or re-registers) the webhook URL with Telegram.</summary>
  Task SetWebhookAsync(
    string url,
    string secretToken,
    CancellationToken cancellationToken = default);
}

public sealed record TelegramSentMessage(long ChatId, int MessageId);
