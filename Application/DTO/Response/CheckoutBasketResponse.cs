using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class CheckoutBasketResponse
{
  public Guid ClientId { get; init; }
  public Guid OrderId { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public Status Status { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
}
