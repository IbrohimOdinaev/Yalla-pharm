using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

public sealed class GetAllUsersRequest
{
  public string Query { get; init; } = string.Empty;
  public Role? Role { get; init; }
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
