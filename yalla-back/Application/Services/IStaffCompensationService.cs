using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public interface IStaffCompensationService
{
  Task EnsureOrderReadyEarningAsync(
    Guid workerId,
    Guid orderId,
    Guid pharmacyId,
    CancellationToken cancellationToken = default);

  Task EnsurePrescriptionDecodedEarningAsync(
    Guid pharmacistId,
    Guid prescriptionId,
    CancellationToken cancellationToken = default);

  Task<StaffCompensationSummaryResponse> GetSummaryAsync(
    Guid staffUserId,
    CancellationToken cancellationToken = default);

  Task<IReadOnlyDictionary<Guid, StaffCompensationSummaryResponse>> GetSummariesAsync(
    IReadOnlyCollection<Guid> staffUserIds,
    CancellationToken cancellationToken = default);

  Task<StaffCompensationMeResponse> GetMeAsync(
    Guid staffUserId,
    CancellationToken cancellationToken = default);

  Task<StaffCompensationPayoutResponse> CreatePayoutAsync(
    Guid superAdminId,
    Guid staffUserId,
    decimal amount,
    StaffPayoutMethod method,
    string? receiptImageKey,
    string? note,
    CancellationToken cancellationToken = default);

  Task<ManualLookupImageContent> GetPayoutReceiptContentAsync(
    Guid payoutId,
    Guid requesterId,
    Role requesterRole,
    CancellationToken cancellationToken = default);
}
