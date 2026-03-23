namespace Yalla.Application.DTO.Request;

public sealed class RejectPaymentIntentBySuperAdminRequest
{
  public Guid SuperAdminId { get; init; }
  public Guid PaymentIntentId { get; init; }
  public string Reason { get; init; } = string.Empty;
}
