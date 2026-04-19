namespace Yalla.Application.DTO.Response;

public sealed class ClientOrderDetailsPositionResponse
{
  public Guid PositionId { get; init; }
  public Guid MedicineId { get; init; }
  public string MedicineTitle { get; init; } = string.Empty;
  public int Quantity { get; init; }
  public int ReturnedQuantity { get; init; }
  public bool IsRejected { get; init; }
  public decimal Price { get; init; }
}
