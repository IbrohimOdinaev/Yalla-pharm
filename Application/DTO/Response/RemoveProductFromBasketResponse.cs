namespace Yalla.Application.DTO.Response;

public sealed class RemoveProductFromBasketResponse
{
  public Guid ClientId { get; init; }
  public Guid RemovedPositionId { get; init; }
  public int BasketItemsCount { get; init; }
}
