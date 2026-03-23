namespace Yalla.Application.DTO.Request;

public sealed class RemoveProductFromBasketRequest
{
  public Guid ClientId { get; init; }
  public Guid PositionId { get; init; }
}
