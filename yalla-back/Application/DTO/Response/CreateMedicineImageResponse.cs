namespace Yalla.Application.DTO.Response;

public sealed class CreateMedicineImageResponse
{
  public MedicineImageResponse MedicineImage { get; init; } = new();
}
