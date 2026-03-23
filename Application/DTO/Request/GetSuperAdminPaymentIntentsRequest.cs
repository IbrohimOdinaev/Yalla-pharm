using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

public sealed class GetSuperAdminPaymentIntentsRequest
{
  public Guid SuperAdminId { get; init; }
  public IReadOnlyCollection<PaymentIntentState> States { get; init; } = [];
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
