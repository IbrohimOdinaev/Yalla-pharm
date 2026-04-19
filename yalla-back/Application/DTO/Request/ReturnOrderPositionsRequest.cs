namespace Yalla.Application.DTO.Request;

public sealed class ReturnOrderPositionsRequest
{
  public Guid OrderId { get; init; }
  public IReadOnlyCollection<ReturnOrderPositionLine> Positions { get; init; } = [];
}

public sealed class ReturnOrderPositionLine
{
  public Guid PositionId { get; init; }
  public int Quantity { get; init; }
}
