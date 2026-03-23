namespace Yalla.Application.DTO.Response;

public sealed class ClearBasketResponse
{
  public Guid ClientId { get; init; }
  public int RemovedPositionsCount { get; init; }
  public int BasketItemsCount { get; init; }
  public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; init; } = [];
}
