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
}
