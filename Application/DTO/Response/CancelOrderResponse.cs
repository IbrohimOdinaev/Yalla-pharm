using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class CancelOrderResponse
{
  public Guid ClientId { get; init; }
  public Guid OrderId { get; init; }
  public Status Status { get; init; }
  public RefundRequestStubResponse RefundRequest { get; init; } = new();
}
