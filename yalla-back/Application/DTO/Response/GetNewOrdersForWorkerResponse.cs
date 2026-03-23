namespace Yalla.Application.DTO.Response;

public sealed class GetNewOrdersForWorkerResponse
{
  public Guid WorkerId { get; init; }
  public Guid PharmacyId { get; init; }
  public IReadOnlyCollection<WorkerOrderResponse> Orders { get; init; } = [];
}
