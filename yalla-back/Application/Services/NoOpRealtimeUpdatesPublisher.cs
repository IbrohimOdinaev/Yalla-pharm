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

  public Task PublishOfferUpdatedAsync(Guid medicineId, Guid pharmacyId, decimal price, int stockQuantity, CancellationToken cancellationToken = default) => Task.CompletedTask;
  public Task PublishOrderStatusChangedAsync(Guid orderId, string status, Guid? clientId, Guid pharmacyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
  public Task PublishBasketUpdatedAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
