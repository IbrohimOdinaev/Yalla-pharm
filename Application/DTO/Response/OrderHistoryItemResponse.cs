using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class OrderHistoryItemResponse
{
  public Guid OrderId { get; init; }
  public Guid PharmacyId { get; init; }
  public DateTime OrderPlacedAt { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public Status Status { get; init; }
  public OrderPaymentState PaymentState { get; init; }
  public DateTime? PaymentExpiresAtUtc { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
  public IReadOnlyCollection<OrderHistoryPositionResponse> Positions { get; init; } = [];
}
