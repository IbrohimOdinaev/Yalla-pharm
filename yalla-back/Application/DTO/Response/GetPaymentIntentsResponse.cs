namespace Yalla.Application.DTO.Response;

public sealed class GetPaymentIntentsResponse
{
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<PaymentIntentResponse> PaymentIntents { get; init; } = [];
}
