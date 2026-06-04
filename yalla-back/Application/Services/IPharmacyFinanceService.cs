using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public interface IPharmacyFinanceService
{
  Task<PharmacyFinanceResponse> GetForAdminAsync(
    Guid adminId,
    Guid pharmacyId,
    CancellationToken cancellationToken = default);

  Task<PharmacyFinanceResponse> GetForSuperAdminAsync(
    CancellationToken cancellationToken = default);

  Task<PharmacyWithdrawalRequestResponse> CreateWithdrawalRequestAsync(
    Guid adminId,
    Guid pharmacyId,
    CreatePharmacyWithdrawalRequest request,
    CancellationToken cancellationToken = default);

  Task<PharmacyWithdrawalRequestResponse> CompleteWithdrawalRequestAsync(
    Guid superAdminId,
    Guid withdrawalRequestId,
    string receiptImageKey,
    string? comment,
    CancellationToken cancellationToken = default);

  Task<Yalla.Application.Abstractions.ManualLookupImageContent> GetReceiptContentAsync(
    Guid withdrawalRequestId,
    Guid requesterId,
    Role requesterRole,
    Guid? requesterPharmacyId,
    CancellationToken cancellationToken = default);
}
