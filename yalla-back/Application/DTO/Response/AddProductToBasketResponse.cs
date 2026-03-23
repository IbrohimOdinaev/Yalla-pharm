namespace Yalla.Application.DTO.Response;

public sealed class AddProductToBasketResponse
{
    public Guid ClientId { get; init; }
    public BasketPositionResponse BasketPosition { get; init; } = new();
    public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; init; } = [];
    public int BasketItemsCount { get; init; }
}
