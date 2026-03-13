namespace Yalla.Application.DTO.Response;

public sealed class RejectOrderPositionsResponse
{
  public Guid WorkerId { get; init; }
  public Guid OrderId { get; init; }
  public IReadOnlyCollection<Guid> RejectedPositionIds { get; init; } = [];
  public WorkerOrderResponse Order { get; init; } = new();
  public RefundRequestStubResponse RefundRequest { get; init; } = new();
}
