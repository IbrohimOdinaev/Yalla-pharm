namespace Yalla.Application.DTO.Request;

public sealed class UpdateBasketPositionQuantityRequest
{
  public Guid ClientId { get; init; }
  public Guid PositionId { get; init; }
  public int Quantity { get; init; }
}
