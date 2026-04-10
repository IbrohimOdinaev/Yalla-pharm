using Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Yalla.Application.Abstractions;

namespace Api.Telegram;

public sealed class SignalRTelegramAuthRealtimePublisher : ITelegramAuthRealtimePublisher
{
  private readonly IHubContext<TelegramAuthHub> _hub;

  public SignalRTelegramAuthRealtimePublisher(IHubContext<TelegramAuthHub> hub)
  {
    _hub = hub;
  }

  public Task PublishConfirmedAsync(string nonce, CancellationToken cancellationToken = default)
    => _hub.Clients.Group(TelegramAuthHub.GroupName(nonce))
      .SendAsync("TelegramAuthConfirmed", new { nonce }, cancellationToken);

  public Task PublishCancelledAsync(string nonce, CancellationToken cancellationToken = default)
    => _hub.Clients.Group(TelegramAuthHub.GroupName(nonce))
      .SendAsync("TelegramAuthCancelled", new { nonce }, cancellationToken);
}
