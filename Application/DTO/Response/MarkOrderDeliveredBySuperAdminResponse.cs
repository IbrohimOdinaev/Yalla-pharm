using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class MarkOrderDeliveredBySuperAdminResponse
{
  public Guid SuperAdminId { get; init; }
  public Guid OrderId { get; init; }
  public Status Status { get; init; }
}
