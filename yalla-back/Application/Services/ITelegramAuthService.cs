using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface ITelegramAuthService
{
  /// <summary>Creates a new pending session and returns the deeplink for the bot.</summary>
  Task<StartTelegramAuthResponse> StartAsync(CancellationToken cancellationToken = default);

  /// <summary>Converts a Confirmed session into a JWT (creating Client if first login).</summary>
  Task<LoginResponse> CompleteAsync(CompleteTelegramAuthRequest request, CancellationToken cancellationToken = default);

  /// <summary>Returns the current state of a session — used by the polling fallback.</summary>
  Task<PollTelegramAuthResponse> PollAsync(string nonce, CancellationToken cancellationToken = default);

  /// <summary>
  /// Bot webhook handler entry point: user pressed "Start" in the bot with our deeplink.
  /// Sends them the inline confirmation prompt.
  /// </summary>
  Task HandleStartCommandAsync(
    string nonce,
    long chatId,
    long telegramUserId,
    string? username,
    string? firstName,
    string? lastName,
    CancellationToken cancellationToken = default);

  /// <summary>Bot webhook: user pressed "Confirm" inline button.</summary>
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

  /// <summary>Bot webhook: user pressed "Cancel" inline button.</summary>
  Task HandleCancelCallbackAsync(
    string nonce,
    string callbackQueryId,
    long chatId,
    int messageId,
    CancellationToken cancellationToken = default);
}
