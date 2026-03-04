using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPharmacyWorkerService
{
    Task<RegisterPharmacyResponse> RegisterPharmacyAsync(
      RegisterPharmacyRequest request,
      CancellationToken cancellationToken = default);

    Task<UpdatePharmacyResponse> UpdatePharmacyAsync(
      UpdatePharmacyRequest request,
      CancellationToken cancellationToken = default);

    Task<DeletePharmacyResponse> DeletePharmacyAsync(
      DeletePharmacyRequest request,
      CancellationToken cancellationToken = default);

    Task<RegisterPharmacyWorkerResponse> RegisterPharmacyWorkerAsync(
      RegisterPharmacyWorkerRequest request,
      CancellationToken cancellationToken = default);

    Task<DeletePharmacyWorkerResponse> DeletePharmacyWorkerAsync(
      DeletePharmacyWorkerRequest request,
      CancellationToken cancellationToken = default);
}
