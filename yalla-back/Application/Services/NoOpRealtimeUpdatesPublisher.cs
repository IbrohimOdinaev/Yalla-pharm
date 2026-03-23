using Yalla.Application.Abstractions;
using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public sealed class NoOpRealtimeUpdatesPublisher : IRealtimeUpdatesPublisher
{
  public Task PublishPaymentIntentUpdatedAsync(
    Guid paymentIntentId,
    Guid clientId,
    PaymentIntentState state,
    Guid? orderId,
    CancellationToken cancellationToken = default)
  {
    return Task.CompletedTask;
  }
}
