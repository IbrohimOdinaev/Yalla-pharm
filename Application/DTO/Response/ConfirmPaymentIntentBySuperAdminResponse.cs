using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class ConfirmPaymentIntentBySuperAdminResponse
{
  public Guid PaymentIntentId { get; init; }
  public Guid ReservedOrderId { get; init; }
  public bool OrderCreated { get; init; }
  public PaymentIntentState PaymentIntentState { get; init; }
  public Status? OrderStatus { get; init; }
  public string? Message { get; init; }
}
