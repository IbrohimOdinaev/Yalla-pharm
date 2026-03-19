namespace Yalla.Application.DTO.Response;

public sealed class DeleteNewOrderByAdminResponse
{
  public Guid WorkerId { get; init; }
  public Guid OrderId { get; init; }
  public bool IsDeleted { get; init; }
}
