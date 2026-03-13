using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public sealed class StubPaymentService : IPaymentService
{
  private const string ProviderName = "StubPayment";
  private const string DeclineEnvName = "YALLA_STUB_PAYMENT_DECLINE";

  public Task<PayForOrderResponse> PayForOrderAsync(
    PayForOrderRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (request.Amount <= 0)
    {
      return Task.FromResult(new PayForOrderResponse
      {
        IsPaid = false,
        Provider = ProviderName,
        Status = "Declined",
        FailureReason = "Payment amount must be positive."
      });
    }

    var rawDeclineFlag = Environment.GetEnvironmentVariable(DeclineEnvName);
    var shouldDecline = string.Equals(rawDeclineFlag, "1", StringComparison.OrdinalIgnoreCase)
      || string.Equals(rawDeclineFlag, "true", StringComparison.OrdinalIgnoreCase);

    if (shouldDecline)
    {
      return Task.FromResult(new PayForOrderResponse
      {
        IsPaid = false,
        Provider = ProviderName,
        Status = "Declined",
        FailureReason = $"Stub payment was declined via env var '{DeclineEnvName}'."
      });
    }

    return Task.FromResult(new PayForOrderResponse
    {
      IsPaid = true,
      Provider = ProviderName,
      Status = "Paid",
      TransactionId = $"stub-{Guid.NewGuid():N}"
    });
  }
}
