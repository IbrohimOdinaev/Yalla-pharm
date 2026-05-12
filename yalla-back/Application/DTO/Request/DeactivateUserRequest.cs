namespace Yalla.Application.DTO.Request;

public sealed class DeactivateUserRequest
{
  /// <summary>Optional free-form reason captured into the user row
  /// and audit log. Auto-truncated to 500 chars by the domain.</summary>
  public string? Reason { get; init; }
}
