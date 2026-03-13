using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPaymentService
{
  Task<PayForOrderResponse> PayForOrderAsync(
    PayForOrderRequest request,
    CancellationToken cancellationToken = default);
}
