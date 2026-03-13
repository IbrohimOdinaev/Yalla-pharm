namespace Yalla.Application.DTO.Response;

public sealed class CheckoutPreviewPositionResponse
{
  public Guid PositionId { get; init; }
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
  public bool IsRejected { get; init; }
  public int FoundQuantity { get; init; }
  public decimal? Price { get; init; }
  public string Reason { get; init; } = string.Empty;
}
