namespace Yalla.Application.DTO.Request;

public sealed class MarkOrderDeliveredBySuperAdminRequest
{
  public Guid SuperAdminId { get; init; }
  public Guid OrderId { get; init; }
}
