namespace Yalla.Application.DTO.Response;

public sealed class BasketOfferResponse
{
  public Guid OfferId { get; init; }
  public Guid PharmacyId { get; init; }
  public decimal Price { get; init; }
  public int StockQuantity { get; init; }
}
