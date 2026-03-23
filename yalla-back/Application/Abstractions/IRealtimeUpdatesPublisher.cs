using Yalla.Domain.Enums;

namespace Yalla.Application.Abstractions;

public interface IRealtimeUpdatesPublisher
{
  Task PublishPaymentIntentUpdatedAsync(
    Guid paymentIntentId,
    Guid clientId,
    PaymentIntentState state,
    Guid? orderId,
    CancellationToken cancellationToken = default);
}
