namespace Yalla.Application.DTO.Response;

public sealed class GetPaymentIntentByIdResponse
{
  public PaymentIntentResponse PaymentIntent { get; init; } = new();
  public Guid? OrderId { get; init; }
}
