namespace Yalla.Application.DTO.Request;

public sealed class VerifyLinkPhoneNumberRequest
{
  public Guid OtpSessionId { get; init; }
  public string Code { get; init; } = string.Empty;
}
