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
}
