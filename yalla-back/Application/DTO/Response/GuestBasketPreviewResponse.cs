namespace Yalla.Application.DTO.Response;

public sealed class GuestBasketPreviewResponse
{
  public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; init; } = [];
}
