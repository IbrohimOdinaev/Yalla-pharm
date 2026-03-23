using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class GetAllUsersResponse
{
  public Role? Role { get; init; }
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<UserListItemResponse> Users { get; init; } = [];
}
