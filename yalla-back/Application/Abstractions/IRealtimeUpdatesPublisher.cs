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

  /// <summary>
  /// Pushed after every prescription status change. Receivers:
  /// every connected pharmacist (queue/review/decoded views refetch) and
  /// the prescription's owner client (for their "Мои рецепты" page).
  /// </summary>
  Task PublishPrescriptionUpdatedAsync(
    Guid prescriptionId,
    Guid clientId,
    PrescriptionStatus status,
    Guid? assignedPharmacistId,
    CancellationToken cancellationToken = default);
}
