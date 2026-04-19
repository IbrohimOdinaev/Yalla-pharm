namespace Yalla.Application.DTO.Response;

public sealed class CancelDeliveryResponse
{
  public Guid OrderId { get; init; }
  public bool Cancelled { get; init; }
}
