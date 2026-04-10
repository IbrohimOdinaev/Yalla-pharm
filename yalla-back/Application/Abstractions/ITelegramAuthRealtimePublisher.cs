namespace Yalla.Application.Abstractions;

/// <summary>
/// Pushes Telegram-auth status changes to the waiting browser via SignalR (or any other transport).
/// </summary>
public interface ITelegramAuthRealtimePublisher
{
  Task PublishConfirmedAsync(string nonce, CancellationToken cancellationToken = default);
  Task PublishCancelledAsync(string nonce, CancellationToken cancellationToken = default);
}
