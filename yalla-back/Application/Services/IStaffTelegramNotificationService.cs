using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IStaffTelegramNotificationService
{
  Task<StaffTelegramRecipientsResponse> GetRecipientsAsync(Guid pharmacyWorkerId, CancellationToken cancellationToken = default);
  Task<StartTelegramAuthResponse> StartLinkAsync(Guid pharmacyWorkerId, CancellationToken cancellationToken = default);
  Task<PollTelegramAuthResponse> PollAsync(Guid pharmacyWorkerId, string nonce, CancellationToken cancellationToken = default);
  Task<StaffTelegramRecipientResponse> CompleteLinkAsync(Guid pharmacyWorkerId, string nonce, CancellationToken cancellationToken = default);
  Task DeleteRecipientAsync(Guid pharmacyWorkerId, Guid recipientId, CancellationToken cancellationToken = default);

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
