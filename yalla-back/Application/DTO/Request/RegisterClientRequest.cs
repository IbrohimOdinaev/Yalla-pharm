namespace Yalla.Application.DTO.Request;

public sealed class RegisterClientRequest
{
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public string Password { get; init; } = string.Empty;
  public bool SkipPhoneVerification { get; init; }
}
