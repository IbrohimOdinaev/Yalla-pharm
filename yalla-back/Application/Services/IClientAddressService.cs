using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IClientAddressService
{
  Task<IReadOnlyCollection<ClientAddressResponse>> GetAllAsync(
    Guid clientId,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// Upsert an address by text. If a matching address exists for the client,
  /// it's returned with updated coords/title and LastUsedAt bumped. Otherwise a
  /// new entry is created. History is capped at 10 unnamed entries per client.
  /// </summary>
  Task<ClientAddressResponse> UpsertAsync(
    Guid clientId,
    UpsertClientAddressRequest request,
    CancellationToken cancellationToken = default);

  Task<ClientAddressResponse> UpdateAsync(
    Guid clientId,
    Guid addressId,
    UpdateClientAddressRequest request,
    CancellationToken cancellationToken = default);

  Task DeleteAsync(
    Guid clientId,
    Guid addressId,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// Called by other services (e.g. checkout) to silently record an address usage.
  /// Never throws if already persisted — just touches LastUsedAt.
  /// </summary>
  Task RecordUsageAsync(
    Guid clientId,
    string address,
    double latitude,
    double longitude,
    CancellationToken cancellationToken = default);
}
