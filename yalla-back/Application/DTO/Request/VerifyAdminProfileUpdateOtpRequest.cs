namespace Yalla.Application.DTO.Request;

public sealed class VerifyAdminProfileUpdateOtpRequest
{
  public Guid OtpSessionId { get; init; }
  public string Code { get; init; } = string.Empty;
}
