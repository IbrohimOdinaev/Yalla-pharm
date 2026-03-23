using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPaymentIntentService
{
  Task<GetPaymentIntentByIdResponse> GetForClientAsync(
    GetClientPaymentIntentByIdRequest request,
    CancellationToken cancellationToken = default);

  Task<GetPaymentIntentByIdResponse> GetForSuperAdminAsync(
    GetSuperAdminPaymentIntentByIdRequest request,
    CancellationToken cancellationToken = default);

  Task<GetPaymentIntentsResponse> GetForSuperAdminAsync(
    GetSuperAdminPaymentIntentsRequest request,
    CancellationToken cancellationToken = default);

  Task<ConfirmPaymentIntentBySuperAdminResponse> ConfirmBySuperAdminAsync(
    ConfirmPaymentIntentBySuperAdminRequest request,
    CancellationToken cancellationToken = default);

  Task<RejectPaymentIntentBySuperAdminResponse> RejectBySuperAdminAsync(
    RejectPaymentIntentBySuperAdminRequest request,
    CancellationToken cancellationToken = default);
}
