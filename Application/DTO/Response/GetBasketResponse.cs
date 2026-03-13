namespace Yalla.Application.DTO.Response;

public sealed class GetBasketResponse
{
  public Guid ClientId { get; init; }
  public int BasketItemsCount { get; init; }
  public IReadOnlyCollection<BasketPositionResponse> BasketPositions { get; init; } = [];
  public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; init; } = [];
}
