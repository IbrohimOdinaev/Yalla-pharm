using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPharmacistService
{
    Task<RegisterPharmacistResponse> RegisterAsync(
      RegisterPharmacistRequest request,
      CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PharmacistResponse>> GetAllAsync(
      CancellationToken cancellationToken = default);

    Task DeleteAsync(
      Guid pharmacistId,
      CancellationToken cancellationToken = default);

    /// <summary>Mark a pharmacist inactive. Login is rejected; tokens
    /// die within ~60s. In-flight InReview prescriptions are NOT
    /// auto-reassigned — the response carries a warning + count so
    /// SuperAdmin can re-route manually.</summary>
    Task<DeactivateUserResponse> DeactivateAsync(
      Guid pharmacistId,
      Guid superAdminId,
      DeactivateUserRequest request,
      CancellationToken cancellationToken = default);

    Task<DeactivateUserResponse> ActivateAsync(
      Guid pharmacistId,
      Guid superAdminId,
      CancellationToken cancellationToken = default);
}
