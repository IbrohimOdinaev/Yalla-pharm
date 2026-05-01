using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IRefundRequestService
{
  Task<GetRefundRequestsResponse> GetRefundRequestsAsync(
    GetRefundRequestsRequest request,
    CancellationToken cancellationToken = default);

  Task<InitiateRefundBySuperAdminResponse> InitiateRefundBySuperAdminAsync(
    InitiateRefundBySuperAdminRequest request,
    CancellationToken cancellationToken = default);

  Task<CompleteRefundBySuperAdminResponse> CompleteRefundBySuperAdminAsync(
    CompleteRefundBySuperAdminRequest request,
    CancellationToken cancellationToken = default);
}
