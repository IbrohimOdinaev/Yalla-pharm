namespace Yalla.Application.DTO.Request;

public sealed class DispatchDeliveryRequest
{
  public Guid WorkerId { get; init; }
  public Guid OrderId { get; init; }
  public int? TariffId { get; init; }
}
