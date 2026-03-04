namespace Yalla.Application.DTO.Response;

public sealed class AddProductToBasketResponse
{
  public Guid ClientId { get; init; }
  public BasketPositionResponse BasketPosition { get; init; } = new();
  public int BasketItemsCount { get; init; }
}
