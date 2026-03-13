namespace Yalla.Application.DTO.Request;

public sealed class PayForOrderRequest
{
  public Guid OrderId { get; init; }
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public decimal Amount { get; init; }
  public string Currency { get; init; } = "TJS";
  public string Description { get; init; } = string.Empty;
  public string IdempotencyKey { get; init; } = string.Empty;
}
