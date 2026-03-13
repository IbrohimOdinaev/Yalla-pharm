namespace Yalla.Application.DTO.Request;

public sealed class CreateMedicineImageRequest
{
  public Guid MedicineId { get; init; }
  public bool? IsMain { get; init; }
  public bool? IsMinimal { get; init; }
}
