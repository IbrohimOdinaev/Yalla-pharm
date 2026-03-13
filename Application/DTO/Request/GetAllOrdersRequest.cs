using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

public sealed class GetAllOrdersRequest
{
  public Status? Status { get; init; }
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
