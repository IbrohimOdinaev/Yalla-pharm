namespace Yalla.Application.DTO.Request;

public sealed class GetSuperAdminPaymentIntentByIdRequest
{
  public Guid SuperAdminId { get; init; }
  public Guid PaymentIntentId { get; init; }
}
