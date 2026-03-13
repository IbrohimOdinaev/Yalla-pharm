namespace Yalla.Application.DTO.Request;

public sealed class GetAdminsRequest
{
  public string Query { get; init; } = string.Empty;
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
