using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class PharmacyFinanceSummaryResponse
{
  public Guid PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public decimal TotalOrderAmount { get; init; }
  public decimal CompletedWithdrawalAmount { get; init; }
  public decimal PendingWithdrawalAmount { get; init; }
  public decimal AvailableAmount { get; init; }
  public int CompletedOrdersCount { get; init; }
  public string Currency { get; init; } = "TJS";
}

public sealed class PharmacyFinanceResponse
{
  public PharmacyFinanceSummaryResponse Summary { get; init; } = new();
  public IReadOnlyList<PharmacyWithdrawalRequestResponse> WithdrawalRequests { get; init; } = [];
}

public sealed class PharmacyWithdrawalRequestResponse
{
  public Guid Id { get; init; }
  public Guid PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public Guid RequestedByAdminId { get; init; }
  public string RequestedByAdminName { get; init; } = string.Empty;
  public string RequestedByAdminPhoneNumber { get; init; } = string.Empty;
  public decimal Amount { get; init; }
  public string Currency { get; init; } = "TJS";
  public PharmacyWithdrawalBank Bank { get; init; }
  public string BankLabel { get; init; } = string.Empty;
  public string WalletPhoneNumber { get; init; } = string.Empty;
  public string DeepLinkUrl { get; init; } = string.Empty;
  public PharmacyWithdrawalStatus Status { get; init; }
  public DateTime CreatedAtUtc { get; init; }
  public DateTime? CompletedAtUtc { get; init; }
  public Guid? CompletedBySuperAdminId { get; init; }
  public string? ReceiptImageUrl { get; init; }
  public string? SuperAdminComment { get; init; }
}
