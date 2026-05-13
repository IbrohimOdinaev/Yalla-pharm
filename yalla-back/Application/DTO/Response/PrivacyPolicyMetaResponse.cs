namespace Yalla.Application.DTO.Response;

/// <summary>
/// Metadata describing the canonical privacy policy version the
/// backend currently enforces. Served from
/// `GET /api/legal/privacy-policy` — frontends use it to decide
/// whether a logged-in client needs a re-acceptance flow.
/// </summary>
public sealed class PrivacyPolicyMetaResponse
{
  public string Version { get; init; } = string.Empty;
  public string EffectiveDate { get; init; } = string.Empty;
}
