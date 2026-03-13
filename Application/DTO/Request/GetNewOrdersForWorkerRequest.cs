namespace Yalla.Application.DTO.Request;

public sealed class GetNewOrdersForWorkerRequest
{
  public Guid WorkerId { get; init; }
  public Guid PharmacyId { get; init; }
  public int Take { get; init; } = 50;
}
