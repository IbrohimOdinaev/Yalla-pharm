namespace Yalla.Application.DTO.Request;

public sealed class CancelDeliveryRequest
{
  public Guid WorkerId { get; init; }
  public Guid OrderId { get; init; }
  public string? Reason { get; init; }
}
