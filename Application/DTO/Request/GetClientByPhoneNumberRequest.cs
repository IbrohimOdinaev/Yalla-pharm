namespace Yalla.Application.DTO.Request;

public sealed class GetClientByPhoneNumberRequest
{
  public string PhoneNumber { get; init; } = string.Empty;
}
