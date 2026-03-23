namespace Yalla.Application.DTO.Request;

public sealed class VerifyClientRegistrationRequest
{
  public Guid RegistrationId { get; init; }
  public string Code { get; init; } = string.Empty;
}
