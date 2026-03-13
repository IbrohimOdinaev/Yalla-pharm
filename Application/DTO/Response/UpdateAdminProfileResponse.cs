using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class UpdateAdminProfileResponse
{
  public Guid AdminId { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public Role Role { get; init; }
}
