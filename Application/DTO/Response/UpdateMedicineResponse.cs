namespace Yalla.Application.DTO.Response;

public sealed class UpdateMedicineResponse
{
  public MedicineResponse Medicine { get; init; } = new();
}
