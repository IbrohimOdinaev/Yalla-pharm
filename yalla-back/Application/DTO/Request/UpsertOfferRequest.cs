namespace Yalla.Application.DTO.Request;

public sealed class UpsertOfferRequest
{
  public Guid MedicineId { get; init; }
  public int StockQuantity { get; init; }
  public decimal Price { get; init; }
}
