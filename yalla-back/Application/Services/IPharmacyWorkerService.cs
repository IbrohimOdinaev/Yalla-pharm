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

    Task<GetActivePharmaciesResponse> GetActivePharmaciesAsync(
      CancellationToken cancellationToken = default);

    Task<GetPharmaciesResponse> GetPharmaciesAsync(
      GetPharmaciesRequest request,
      CancellationToken cancellationToken = default);

    Task<GetAdminsResponse> GetAdminsAsync(
      GetAdminsRequest request,
      CancellationToken cancellationToken = default);

    Task<RegisterPharmacyWorkerResponse> RegisterPharmacyWorkerAsync(
      RegisterPharmacyWorkerRequest request,
      CancellationToken cancellationToken = default);

    Task<RegisterAdminWithPharmacyResponse> RegisterAdminWithPharmacyAsync(
      RegisterAdminWithPharmacyRequest request,
      CancellationToken cancellationToken = default);

    Task<UpsertOfferResponse> UpsertOfferAsync(
      UpsertOfferRequest request,
      Guid pharmacyId,
      CancellationToken cancellationToken = default);

    Task<DeletePharmacyWorkerResponse> DeletePharmacyWorkerAsync(
      DeletePharmacyWorkerRequest request,
      CancellationToken cancellationToken = default);

    Task<DeletePharmacyWorkerResponse> DeletePharmacyWorkerInPharmacyAsync(
      DeletePharmacyWorkerRequest request,
      Guid pharmacyId,
      CancellationToken cancellationToken = default);
}
