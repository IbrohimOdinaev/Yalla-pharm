namespace Yalla.Application.DTO.Request;

public sealed class CheckoutBasketRequest
{
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public long? DeliveryAddressId { get; init; }
  public string? DeliveryAddressTitle { get; init; }
  public double? DeliveryLatitude { get; init; }
  public double? DeliveryLongitude { get; init; }
  public string IdempotencyKey { get; init; } = string.Empty;
  public IReadOnlyCollection<Guid> IgnoredPositionIds { get; init; } = [];
}
