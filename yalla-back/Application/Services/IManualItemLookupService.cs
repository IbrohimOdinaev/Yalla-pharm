using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public sealed class ManualLookupImageUpload
{
    public required Stream Content { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public long Length { get; init; }
}

public interface IManualItemLookupService
{
    // Pharmacist
    Task<ManualLookupRequestResponse> CreateRequestAsync(
      Guid pharmacistId,
      CreateManualLookupRequest request,
      CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ManualLookupRequestResponse>> GetByPrescriptionForPharmacistAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default);

    Task<ManualLookupRequestResponse> GetByIdForPharmacistAsync(
      Guid pharmacistId,
      Guid requestId,
      CancellationToken cancellationToken = default);

    // Admin
    Task<IReadOnlyList<ManualLookupRequestResponse>> GetActiveForAdminAsync(
      Guid adminId,
      CancellationToken cancellationToken = default);

    Task<GetManualLookupHistoryResponse> GetHistoryForAdminAsync(
      Guid adminId,
      GetManualLookupHistoryRequest request,
      CancellationToken cancellationToken = default);

    Task<ManualLookupResponseResponse> RespondAsync(
      Guid adminId,
      Guid requestId,
      RespondToManualLookupRequest request,
      ManualLookupImageUpload? image,
      CancellationToken cancellationToken = default);

    Task<ManualLookupResponseResponse?> GetMyResponseAsync(
      Guid adminId,
      Guid requestId,
      CancellationToken cancellationToken = default);

    // Internal — called from PrescriptionService when checklist is submitted
    // or the prescription is cancelled. Closes every Open request for the
    // prescription and publishes SignalR notifications.
    Task CloseRequestsForPrescriptionAsync(
      Guid prescriptionId,
      CancellationToken cancellationToken = default);
}
