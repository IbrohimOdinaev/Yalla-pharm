namespace Yalla.Application.DTO.Response;

public sealed class MedicineOfferResponse
{
  public Guid OfferId { get; init; }
  public Guid PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public bool PharmacyIsActive { get; init; }
  public int StockQuantity { get; init; }
  public decimal Price { get; init; }
  public bool IsAvailable { get; init; }
}
