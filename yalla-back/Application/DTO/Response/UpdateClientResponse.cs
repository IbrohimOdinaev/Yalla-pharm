namespace Yalla.Application.DTO.Response;

public sealed class UpdateClientResponse
{
  public ClientResponse Client { get; init; } = new();
}
