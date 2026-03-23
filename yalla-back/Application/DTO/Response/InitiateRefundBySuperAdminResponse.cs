using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class InitiateRefundBySuperAdminResponse
{
  public Guid SuperAdminId { get; init; }
  public Guid RefundRequestId { get; init; }
  public RefundRequestStatus PreviousStatus { get; init; }
  public RefundRequestStatus Status { get; init; }
  public DateTime UpdatedAtUtc { get; init; }
}
