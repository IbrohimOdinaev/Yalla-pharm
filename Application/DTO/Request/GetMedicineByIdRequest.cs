namespace Yalla.Application.DTO.Request;

public sealed class GetMedicineByIdRequest
{
  public Guid MedicineId { get; init; }
  public bool IncludeInactive { get; init; }
}
