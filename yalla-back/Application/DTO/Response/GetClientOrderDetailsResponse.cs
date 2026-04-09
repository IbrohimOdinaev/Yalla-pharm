using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class GetClientOrderDetailsResponse
{
  public Guid ClientId { get; init; }
  public Guid OrderId { get; init; }
  public Guid PharmacyId { get; init; }
  public DateTime OrderPlacedAt { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public Status Status { get; init; }
  public OrderPaymentState PaymentState { get; init; }
  public DateTime? PaymentExpiresAtUtc { get; init; }
  public string? PaymentUrl { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
  public decimal DeliveryCost { get; init; }
  public string? DriverName { get; init; }
  public string? DriverPhone { get; init; }
  public string? JuraStatus { get; init; }
  public IReadOnlyCollection<ClientOrderDetailsPositionResponse> Positions { get; init; } = [];
}
