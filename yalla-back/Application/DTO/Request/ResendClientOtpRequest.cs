namespace Yalla.Application.DTO.Request;

public sealed class ResendClientOtpRequest
{
  public Guid OtpSessionId { get; init; }
}
