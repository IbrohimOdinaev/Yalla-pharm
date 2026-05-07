namespace Yalla.Application.DTO.Response;

public sealed class GetMedicinesByIdsResponse
{
  public IReadOnlyList<MedicineResponse> Medicines { get; init; } = Array.Empty<MedicineResponse>();
}
