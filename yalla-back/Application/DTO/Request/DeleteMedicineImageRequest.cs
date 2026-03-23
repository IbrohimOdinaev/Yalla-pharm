namespace Yalla.Application.DTO.Request;

public sealed class DeleteMedicineImageRequest
{
  public Guid MedicineId { get; init; }
  public Guid MedicineImageId { get; init; }
}
