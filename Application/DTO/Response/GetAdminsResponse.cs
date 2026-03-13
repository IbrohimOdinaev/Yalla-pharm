namespace Yalla.Application.DTO.Response;

public sealed class GetAdminsResponse
{
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<AdminListItemResponse> Admins { get; init; } = [];
}
