namespace Yalla.Application.DTO.Request;

public sealed class UpdateMyClientProfileRequest
{
  public string? Name { get; init; }
  public string? PhoneNumber { get; init; }
  public int? Gender { get; init; }
  public string? DateOfBirth { get; init; }
}
