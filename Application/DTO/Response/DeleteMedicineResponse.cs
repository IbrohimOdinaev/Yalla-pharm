namespace Yalla.Application.DTO.Response;

public sealed class DeleteMedicineResponse
{
  public Guid MedicineId { get; init; }
  public bool IsActive { get; init; }
}
