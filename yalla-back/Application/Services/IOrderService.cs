using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IOrderService
{
  Task<GetAllOrdersResponse> GetAllOrdersAsync(
    GetAllOrdersRequest request,
    CancellationToken cancellationToken = default);

  Task<GetClientOrderHistoryResponse> GetClientOrderHistoryAsync(
    GetClientOrderHistoryRequest request,
    CancellationToken cancellationToken = default);

  Task<GetClientOrderDetailsResponse> GetClientOrderDetailsAsync(
    GetClientOrderDetailsRequest request,
    CancellationToken cancellationToken = default);

  Task<GetPharmacyOrdersResponse> GetPharmacyOrdersAsync(
    GetPharmacyOrdersRequest request,
    CancellationToken cancellationToken = default);

  Task<GetNewOrdersForWorkerResponse> GetNewOrdersForWorkerAsync(
    GetNewOrdersForWorkerRequest request,
    CancellationToken cancellationToken = default);

  Task<StartOrderAssemblyResponse> StartOrderAssemblyAsync(
    StartOrderAssemblyRequest request,
    CancellationToken cancellationToken = default);

  Task<RejectOrderPositionsResponse> RejectOrderPositionsAsync(
    RejectOrderPositionsRequest request,
    CancellationToken cancellationToken = default);

  Task<MarkOrderReadyResponse> MarkOrderReadyAsync(
    MarkOrderReadyRequest request,
    CancellationToken cancellationToken = default);

  Task<MarkOrderOnTheWayResponse> MarkOrderOnTheWayAsync(
    MarkOrderOnTheWayRequest request,
    CancellationToken cancellationToken = default);

  Task<MarkOrderDeliveredBySuperAdminResponse> MarkOrderDeliveredBySuperAdminAsync(
    MarkOrderDeliveredBySuperAdminRequest request,
    CancellationToken cancellationToken = default);

  Task<MarkOrderDeliveredBySuperAdminResponse> MoveOrderToNextStatusBySuperAdminAsync(
    MarkOrderDeliveredBySuperAdminRequest request,
    CancellationToken cancellationToken = default);

  Task<DeleteNewOrderByAdminResponse> DeleteNewOrderByAdminAsync(
    DeleteNewOrderByAdminRequest request,
    CancellationToken cancellationToken = default);

  Task<CancelOrderResponse> CancelOrderAsync(
    CancelOrderRequest request,
    CancellationToken cancellationToken = default);

  Task<CancelOrderResponse> CancelOrderBySuperAdminAsync(
    Guid orderId,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// Pharmacy admin cancels an order that belongs to their pharmacy. Allowed
  /// from UnderReview / Preparing / Ready.
  /// </summary>
  Task<CancelOrderResponse> CancelOrderByAdminAsync(
    Guid orderId,
    Guid pharmacyId,
    Guid actorUserId,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// SuperAdmin records a post-delivery return: client returned (some of) the
  /// medicines. Order status moves to <see cref="Domain.Enums.Status.Returned"/>
  /// and ReturnCost grows to include the returned units.
  /// </summary>
  Task<CancelOrderResponse> ReturnOrderPositionsBySuperAdminAsync(
    ReturnOrderPositionsRequest request,
    Guid actorUserId,
    CancellationToken cancellationToken = default);

  Task<DispatchDeliveryResponse> DispatchDeliveryAsync(
    DispatchDeliveryRequest request,
    CancellationToken cancellationToken = default);

  Task<CancelDeliveryResponse> CancelDeliveryAsync(
    CancelDeliveryRequest request,
    CancellationToken cancellationToken = default);

  Task<List<JuraTariff>> GetDeliveryTariffsAsync(
    CancellationToken cancellationToken = default);

  /// <summary>
  /// System-initiated cancellation triggered by JURA signalling the delivery was
  /// cancelled on their side (status_id=10). Restores stock, creates a refund
  /// stub, does NOT attempt to call JURA cancel (the delivery is already gone).
  /// </summary>
  Task CancelOrderFromJuraAsync(
    Guid orderId,
    string reason,
    CancellationToken cancellationToken = default);
}
