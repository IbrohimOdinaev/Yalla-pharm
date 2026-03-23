namespace Yalla.Application.DTO.Request;

public sealed class GetClientPaymentIntentByIdRequest
{
  public Guid ClientId { get; init; }
  public Guid PaymentIntentId { get; init; }
}
