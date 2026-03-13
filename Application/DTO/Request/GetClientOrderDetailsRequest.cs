namespace Yalla.Application.DTO.Request;

public sealed class GetClientOrderDetailsRequest
{
  public Guid ClientId { get; init; }
  public Guid OrderId { get; init; }
}
