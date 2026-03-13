using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class ClientOrderResponse
{
  public Guid OrderId { get; init; }
  public Guid PharmacyId { get; init; }
  public DateTime OrderPlacedAt { get; init; }
  public Status Status { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
}
