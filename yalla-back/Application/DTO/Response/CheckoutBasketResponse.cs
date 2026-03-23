using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class CheckoutBasketResponse
{
  public Guid ClientId { get; init; }
  public Guid PaymentIntentId { get; init; }
  public Guid ReservedOrderId { get; init; }
  public string Currency { get; init; } = "TJS";
  public DateTime CreatedAtUtc { get; init; }
  public Yalla.Domain.Enums.PaymentIntentState PaymentIntentState { get; init; }
  public Guid OrderId { get; init; }
  public DateTime OrderPlacedAt { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public Status Status { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
  public OrderPaymentState PaymentState { get; init; }
  public DateTime? PaymentExpiresAtUtc { get; init; }
  public string? PaymentUrl { get; init; }
}
