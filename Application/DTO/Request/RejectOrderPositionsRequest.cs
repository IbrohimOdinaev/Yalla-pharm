namespace Yalla.Application.DTO.Request;

public sealed class RejectOrderPositionsRequest
{
  public Guid WorkerId { get; init; }
  public Guid PharmacyId { get; init; }
  public Guid OrderId { get; init; }
  public IReadOnlyCollection<Guid> PositionIds { get; init; } = [];
}
