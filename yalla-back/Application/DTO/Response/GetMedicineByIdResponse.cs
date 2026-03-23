namespace Yalla.Application.DTO.Response;

public sealed class GetMedicineByIdResponse
{
  public MedicineResponse Medicine { get; init; } = new();
}
