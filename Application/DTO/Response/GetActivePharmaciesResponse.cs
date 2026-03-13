namespace Yalla.Application.DTO.Response;

public sealed class GetActivePharmaciesResponse
{
  public IReadOnlyCollection<PharmacyResponse> Pharmacies { get; init; } = [];
}
