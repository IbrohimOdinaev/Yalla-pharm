using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class RejectPaymentIntentBySuperAdminResponse
{
  public Guid PaymentIntentId { get; init; }
  public Guid ReservedOrderId { get; init; }
  public PaymentIntentState PaymentIntentState { get; init; }
  public string? RejectReason { get; init; }
}
