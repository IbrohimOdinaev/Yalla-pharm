namespace Yalla.Application.DTO.Response;

public sealed class WorkerMedicineResponse
{
  public Guid Id { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Articul { get; init; } = string.Empty;
  public IReadOnlyCollection<MedicineImageResponse> Images { get; init; } = [];
  public bool IsActive { get; init; }
}
