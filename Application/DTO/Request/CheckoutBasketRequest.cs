namespace Yalla.Application.DTO.Request;

public sealed class CheckoutBasketRequest
{
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public string IdempotencyKey { get; init; } = string.Empty;
  public IReadOnlyCollection<Guid> IgnoredPositionIds { get; init; } = [];
}
