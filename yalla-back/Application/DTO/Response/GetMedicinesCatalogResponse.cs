namespace Yalla.Application.DTO.Response;

public sealed class GetMedicinesCatalogResponse
{
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<MedicineSearchItemResponse> Medicines { get; init; } = [];
}
