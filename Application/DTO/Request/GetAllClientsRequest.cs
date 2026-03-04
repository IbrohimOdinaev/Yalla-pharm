namespace Yalla.Application.DTO.Request;

public sealed class GetAllClientsRequest
{
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
