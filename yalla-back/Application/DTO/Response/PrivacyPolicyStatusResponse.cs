namespace Yalla.Application.DTO.Response;

/// <summary>
/// Per-client privacy-policy acceptance status. The frontend uses it
/// to decide whether to show the accept-modal before any sensitive
/// flow (today: prescription submission).
/// </summary>
public sealed class PrivacyPolicyStatusResponse
{
  /// <summary>True iff the client has accepted the policy version
  /// currently in force. False both for "never accepted" and
  /// "accepted an older version".</summary>
  public bool Accepted { get; init; }

  /// <summary>The version the client most recently accepted, or null
  /// if they never accepted any version.</summary>
  public string? AcceptedVersion { get; init; }

  /// <summary>The current configured version — what the client must
  /// accept to clear the gate.</summary>
  public string CurrentVersion { get; init; } = string.Empty;
}
