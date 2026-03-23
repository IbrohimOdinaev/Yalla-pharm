using Microsoft.AspNetCore.SignalR;
using Yalla.Application.Abstractions;
using Yalla.Domain.Enums;

namespace Api.Hubs;

public sealed class SignalRRealtimeUpdatesPublisher : IRealtimeUpdatesPublisher
{
  private readonly IHubContext<UpdatesHub> _hubContext;

  public SignalRRealtimeUpdatesPublisher(IHubContext<UpdatesHub> hubContext)
  {
    ArgumentNullException.ThrowIfNull(hubContext);
    _hubContext = hubContext;
  }

  public async Task PublishPaymentIntentUpdatedAsync(
    Guid paymentIntentId,
    Guid clientId,
    PaymentIntentState state,
    Guid? orderId,
    CancellationToken cancellationToken = default)
  {
    var payload = new
    {
      paymentIntentId,
      state = (int)state,
      orderId
    };

    var clientTask = _hubContext.Clients
      .User(clientId.ToString())
      .SendAsync("PaymentIntentUpdated", payload, cancellationToken);

    var superAdminTask = _hubContext.Clients
      .Group(UpdatesHub.SuperAdminGroup)
      .SendAsync("PaymentIntentUpdated", payload, cancellationToken);

    await Task.WhenAll(clientTask, superAdminTask);
  }
}
