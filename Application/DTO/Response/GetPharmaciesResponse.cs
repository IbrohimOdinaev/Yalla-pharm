namespace Yalla.Application.DTO.Response;

public sealed class GetPharmaciesResponse
{
  public bool? IsActive { get; init; }
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<PharmacyResponse> Pharmacies { get; init; } = [];
}
