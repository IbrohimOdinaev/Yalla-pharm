namespace Yalla.Application.DTO.Response;

public sealed class UpsertOfferResponse
{
  public Guid OfferId { get; init; }
  public Guid MedicineId { get; init; }
  public Guid PharmacyId { get; init; }
  public int StockQuantity { get; init; }
  public decimal Price { get; init; }
  public bool Created { get; init; }
}
