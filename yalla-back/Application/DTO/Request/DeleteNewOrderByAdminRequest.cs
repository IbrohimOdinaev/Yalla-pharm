namespace Yalla.Application.DTO.Request;

public sealed class DeleteNewOrderByAdminRequest
{
  public Guid WorkerId { get; init; }
  public Guid PharmacyId { get; init; }
  public Guid OrderId { get; init; }
}
