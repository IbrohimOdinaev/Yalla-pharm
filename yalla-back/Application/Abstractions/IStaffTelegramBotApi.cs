namespace Yalla.Application.Abstractions;

public interface IStaffTelegramBotApi
{
  Task<TelegramSentMessage> SendConfirmationPromptAsync(
    long chatId,
    string text,
    string confirmCallbackData,
    string cancelCallbackData,
    string confirmButtonText,
    string cancelButtonText,
    CancellationToken cancellationToken = default);

  Task EditMessageTextAsync(
    long chatId,
    int messageId,
    string newText,
    CancellationToken cancellationToken = default);

  Task AnswerCallbackQueryAsync(
    string callbackQueryId,
    string? text = null,
    bool showAlert = false,
    CancellationToken cancellationToken = default);

  Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default);

  Task SetWebhookAsync(string url, string secretToken, CancellationToken cancellationToken = default);
}
