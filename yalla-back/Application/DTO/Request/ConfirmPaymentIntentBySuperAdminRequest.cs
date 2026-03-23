namespace Yalla.Application.DTO.Request;

public sealed class ConfirmPaymentIntentBySuperAdminRequest
{
  public Guid SuperAdminId { get; init; }
  public Guid PaymentIntentId { get; init; }
}
