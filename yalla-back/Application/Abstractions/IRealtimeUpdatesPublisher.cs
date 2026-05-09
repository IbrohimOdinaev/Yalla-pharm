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

  /// <summary>
  /// Pushed when a pharmacist creates a new manual-item lookup request.
  /// Receivers: every connected pharmacy admin (so the "active" tab
  /// updates in real time without polling).
  /// </summary>
  Task PublishManualLookupRequestCreatedAsync(
    Guid requestId,
    Guid prescriptionId,
    Guid requestedByPharmacistId,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// Pushed when a pharmacy admin upserts their response for a lookup
  /// request. Receivers: the pharmacist who initiated the request (so
  /// their lookup-detail panel refreshes).
  /// </summary>
  Task PublishManualLookupResponseAddedAsync(
    Guid requestId,
    Guid responseId,
    Guid respondingPharmacyId,
    Guid requestedByPharmacistId,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// Pushed when a request transitions to <c>Closed</c> (typically when
  /// the pharmacist submits the prescription's checklist). Receivers:
  /// every connected pharmacy admin (so their "active" tab drops it and
  /// "history" tab picks it up).
  /// </summary>
  Task PublishManualLookupRequestClosedAsync(
    Guid requestId,
    CancellationToken cancellationToken = default);
}
