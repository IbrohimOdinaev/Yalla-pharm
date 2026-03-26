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

  Task PublishOfferUpdatedAsync(
    Guid medicineId, Guid pharmacyId, decimal price, int stockQuantity,
    CancellationToken cancellationToken = default);

  Task PublishOrderStatusChangedAsync(
    Guid orderId, string status, Guid? clientId, Guid pharmacyId,
    CancellationToken cancellationToken = default);

  Task PublishBasketUpdatedAsync(
    Guid userId,
    CancellationToken cancellationToken = default);
}
