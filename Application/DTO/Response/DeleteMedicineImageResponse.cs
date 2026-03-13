namespace Yalla.Application.DTO.Response;

public sealed class DeleteMedicineImageResponse
{
  public Guid MedicineId { get; init; }
  public Guid MedicineImageId { get; init; }
}
