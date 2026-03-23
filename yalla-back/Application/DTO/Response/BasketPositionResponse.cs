namespace Yalla.Application.DTO.Response;

public sealed class BasketPositionResponse
{
  public Guid PositionId { get; init; }
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
}
