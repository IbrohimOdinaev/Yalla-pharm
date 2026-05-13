namespace Yalla.Application.DTO.Request;

public sealed class AcceptPrivacyPolicyRequest
{
  /// <summary>Version string the client is accepting (e.g.
  /// "1.0-2026-05-12"). Must match
  /// <c>Compliance:PrivacyPolicyCurrentVersion</c> exactly —
  /// the service rejects mismatches with a 400 so we never log
  /// consent against an outdated policy text the user didn't read.</summary>
  public string Version { get; init; } = string.Empty;
}
