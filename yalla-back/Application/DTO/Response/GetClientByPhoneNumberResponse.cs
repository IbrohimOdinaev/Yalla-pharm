namespace Yalla.Application.DTO.Response;

public sealed class GetClientByPhoneNumberResponse
{
  public ClientResponse Client { get; init; } = new();
}
