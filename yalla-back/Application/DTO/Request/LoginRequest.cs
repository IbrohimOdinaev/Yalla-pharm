namespace Yalla.Application.DTO.Request;

public sealed class LoginRequest
{
  public string PhoneNumber { get; init; } = string.Empty;
  public string Password { get; init; } = string.Empty;
}
