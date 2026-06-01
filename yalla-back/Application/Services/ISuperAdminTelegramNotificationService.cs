using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface ISuperAdminTelegramNotificationService
{
  Task<SuperAdminTelegramRecipientsResponse> GetRecipientsAsync(Guid superAdminId, CancellationToken cancellationToken = default);
  Task<StartTelegramAuthResponse> StartLinkAsync(Guid superAdminId, CancellationToken cancellationToken = default);
  Task<PollTelegramAuthResponse> PollAsync(Guid superAdminId, string nonce, CancellationToken cancellationToken = default);
  Task<SuperAdminTelegramRecipientResponse> CompleteLinkAsync(Guid superAdminId, string nonce, CancellationToken cancellationToken = default);
  Task DeleteRecipientAsync(Guid superAdminId, Guid recipientId, CancellationToken cancellationToken = default);

  Task HandleStartCommandAsync(
    string nonce,
    long chatId,
    long telegramUserId,
    string? username,
    string? firstName,
    string? lastName,
    CancellationToken cancellationToken = default);

  Task HandleConfirmCallbackAsync(
    string nonce,
    string callbackQueryId,
    long chatId,
    int messageId,
    long telegramUserId,
    string? username,
    string? firstName,
    string? lastName,
    CancellationToken cancellationToken = default);

  Task HandleCancelCallbackAsync(
    string nonce,
    string callbackQueryId,
    long chatId,
    int messageId,
    CancellationToken cancellationToken = default);
}
