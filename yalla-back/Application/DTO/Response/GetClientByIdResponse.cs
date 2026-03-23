namespace Yalla.Application.DTO.Response;

public sealed class GetClientByIdResponse
{
  public ClientResponse Client { get; init; } = new();
}
