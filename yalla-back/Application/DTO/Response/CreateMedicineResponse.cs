namespace Yalla.Application.DTO.Response;

public sealed class CreateMedicineResponse
{
    public MedicineResponse Medicine { get; init; } = new();
}
