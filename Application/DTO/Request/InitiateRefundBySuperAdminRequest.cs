namespace Yalla.Application.DTO.Request;

public sealed class InitiateRefundBySuperAdminRequest
{
  public Guid SuperAdminId { get; init; }
  public Guid RefundRequestId { get; init; }
}
