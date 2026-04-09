namespace Yalla.Application.DTO.Request;

public sealed class VerifyClientOtpRequest
{
  public Guid OtpSessionId { get; init; }
  public string Code { get; init; } = string.Empty;
  public string? Name { get; init; }
}
