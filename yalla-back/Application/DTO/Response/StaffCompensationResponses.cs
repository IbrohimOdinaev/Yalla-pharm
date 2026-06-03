namespace Yalla.Application.DTO.Response;

public sealed class StaffCompensationSummaryResponse
{
  public Guid StaffUserId { get; init; }
  public string StaffRole { get; init; } = string.Empty;
  public int EarnedWorkItemsCount { get; init; }
  public decimal EarnedAmount { get; init; }
  public decimal PaidAmount { get; init; }
  public decimal BalanceAmount { get; init; }
  public string Currency { get; init; } = "TJS";
}

public sealed class StaffCompensationEarningResponse
{
  public Guid Id { get; init; }
  public string SourceType { get; init; } = string.Empty;
  public Guid SourceId { get; init; }
  public decimal Amount { get; init; }
  public string Currency { get; init; } = "TJS";
  public DateTime CreatedAtUtc { get; init; }
}

public sealed class StaffCompensationPayoutResponse
{
  public Guid Id { get; init; }
  public decimal Amount { get; init; }
  public string Currency { get; init; } = "TJS";
  public string Method { get; init; } = string.Empty;
  public string? ReceiptImageUrl { get; init; }
  public string? Note { get; init; }
  public DateTime PaidAtUtc { get; init; }
}

public sealed class StaffCompensationMeResponse
{
  public StaffCompensationSummaryResponse Summary { get; init; } = new();
  public IReadOnlyList<StaffCompensationEarningResponse> RecentEarnings { get; init; } = [];
  public IReadOnlyList<StaffCompensationPayoutResponse> RecentPayouts { get; init; } = [];
}
