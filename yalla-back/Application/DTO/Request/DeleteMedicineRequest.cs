namespace Yalla.Application.DTO.Request;

public sealed class DeleteMedicineRequest
{
  public Guid MedicineId { get; init; }
  public bool Permanently { get; init; }
}
