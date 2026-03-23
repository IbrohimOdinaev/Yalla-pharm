namespace Yalla.Application.DTO.Request;

public sealed class CancelOrderRequest
{
  public Guid ClientId { get; init; }
  public Guid OrderId { get; init; }
}
