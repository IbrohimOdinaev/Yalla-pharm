namespace Yalla.Application.DTO.Response;

public sealed class SearchByPharmacyResponse
{
  public string Query { get; init; } = string.Empty;
  public int TotalCount { get; init; }
  public IReadOnlyCollection<PharmacyMedicinesGroup> Pharmacies { get; init; } = [];
}

public sealed class PharmacyMedicinesGroup
{
  public Guid PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public int TotalInPharmacy { get; init; }
  public IReadOnlyCollection<MedicineSearchItemResponse> Medicines { get; init; } = [];
}
