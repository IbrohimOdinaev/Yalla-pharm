using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class StartOrderAssemblyResponse
{
  public Guid WorkerId { get; init; }
  public Guid OrderId { get; init; }
  public Status Status { get; init; }
}
