namespace Yalla.Application.DTO.Response;

public sealed class DispatchDeliveryResponse
{
  public Guid OrderId { get; init; }
  public long JuraOrderId { get; init; }
  public string JuraStatus { get; init; } = string.Empty;
  public int JuraStatusId { get; init; }
  public decimal DeliveryCost { get; init; }
  public string? DriverName { get; init; }
  public string? DriverPhone { get; init; }
  public bool AlreadyDispatched { get; init; }
}
