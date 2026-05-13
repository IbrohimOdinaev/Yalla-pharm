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

    /// <summary>Mark the pharmacy worker inactive. Login is rejected
    /// immediately; already-issued access tokens stop being honoured
    /// within ~60s via the JWT validation handler's cache window.
    /// In-flight work (Preparing orders) is NOT auto-reassigned —
    /// the response carries a warning + count so the SuperAdmin can
    /// re-route those manually.</summary>
    Task<DeactivateUserResponse> DeactivatePharmacyWorkerAsync(
      Guid workerId,
      Guid superAdminId,
      DeactivateUserRequest request,
      CancellationToken cancellationToken = default);

    Task<DeactivateUserResponse> ActivatePharmacyWorkerAsync(
      Guid workerId,
      Guid superAdminId,
      CancellationToken cancellationToken = default);
}
