namespace Yalla.Application.DTO.Request;

public sealed class CompleteRefundBySuperAdminRequest
{
  public Guid SuperAdminId { get; init; }
  public Guid RefundRequestId { get; init; }
}
