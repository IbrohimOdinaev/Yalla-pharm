using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class LoginResponse
{
  public Guid UserId { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public Role Role { get; init; }
  public string AccessToken { get; init; } = string.Empty;
  public DateTime ExpiresAtUtc { get; init; }
}
