namespace Yalla.Application.DTO.Response;

public sealed class CheckoutPreviewResponse
{
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public bool CanCheckout { get; init; }
  public int TotalPositions { get; init; }
  public int AcceptedPositionsCount { get; init; }
  public int RejectedPositionsCount { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
  public IReadOnlyCollection<CheckoutPreviewPositionResponse> Positions { get; init; } = [];
}
