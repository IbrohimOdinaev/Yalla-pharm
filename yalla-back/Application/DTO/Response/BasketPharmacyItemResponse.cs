namespace Yalla.Application.DTO.Response;

public sealed class BasketPharmacyItemResponse
{
    public Guid MedicineId { get; init; }
    public int RequestedQuantity { get; init; }
    public bool IsFound { get; init; }
    public int FoundQuantity { get; init; }
    public bool HasEnoughQuantity { get; init; }
    public decimal? Price { get; init; }
}
