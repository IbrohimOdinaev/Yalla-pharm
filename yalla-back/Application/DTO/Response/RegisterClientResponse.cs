namespace Yalla.Application.DTO.Response;

public sealed class RegisterClientResponse
{
  public ClientResponse Client { get; init; } = new();
}
