namespace Yalla.Application.DTO.Response;

public sealed class WorkerOrderPositionResponse
{
  public Guid PositionId { get; init; }
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
  public bool IsRejected { get; init; }
  public decimal Price { get; init; }
  public WorkerMedicineResponse Medicine { get; init; } = new();
}
