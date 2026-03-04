namespace Yalla.Application.DTO.Request;

public sealed class UpdateMedicineRequest
{
  public Guid MedicineId { get; init; }
  public string? Url { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Articul { get; init; } = string.Empty;
}
