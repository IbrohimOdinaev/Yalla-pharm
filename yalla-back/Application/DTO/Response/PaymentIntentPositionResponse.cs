namespace Yalla.Application.DTO.Response;

public sealed class PaymentIntentPositionResponse
{
  public Guid Id { get; init; }
  public Guid MedicineId { get; init; }
  public Guid OfferPharmacyId { get; init; }
  public decimal OfferPrice { get; init; }
  public int Quantity { get; init; }
}
