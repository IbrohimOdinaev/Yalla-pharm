namespace Yalla.Application.DTO.Request;

public sealed class RequestAdminProfileUpdateOtpRequest
{
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
}
