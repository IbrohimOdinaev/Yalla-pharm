namespace Yalla.Application.Common;

/// <summary>
/// Strongly-typed binding for the <c>Compliance:*</c> appsettings
/// section — keeps the privacy-policy gate from reaching into raw
/// IConfiguration (which the Application project doesn't reference).
/// Section name: "Compliance".
/// </summary>
public sealed class ComplianceOptions
{
  public const string SectionName = "Compliance";

  /// <summary>Canonical version string of the currently-enforced
  /// privacy policy (e.g. "1.0-2026-05-12"). The frontend's
  /// `privacy-policy.meta.ts` must stay in sync with this value —
  /// out-of-sync configs make the acceptance flow loop forever.</summary>
  public string PrivacyPolicyCurrentVersion { get; set; } = string.Empty;

  /// <summary>Display-only effective date shown next to the policy
  /// version on the legal page; not enforced anywhere.</summary>
  public string PrivacyPolicyEffectiveDate { get; set; } = string.Empty;
}
