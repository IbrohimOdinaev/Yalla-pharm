using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// Append-only ledger of every privacy-policy acceptance event by a
/// client. Mirrors <see cref="Client.PrivacyPolicyVersionAccepted"/>
/// (which only carries the most recent acceptance) so we can produce
/// "when did the client accept version X" reports for compliance audits.
///
/// Per Закон Республики Таджикистан № 1537 "О защите персональных
/// данных" the operator must be able to demonstrate, on demand, that a
/// specific subject consented to a specific version of the policy at a
/// specific time — this table is the canonical record.
/// </summary>
public sealed class ClientConsentHistory
{
  public Guid Id { get; private set; }
  public Guid ClientId { get; private set; }
  public string PolicyVersion { get; private set; } = string.Empty;
  public DateTime AcceptedAtUtc { get; private set; }
  public string? AcceptedFromIp { get; private set; }
  /// <summary>User-agent header truncated to 500 chars, or null if
  /// not available. Helps to spot suspicious patterns (e.g. one client
  /// id "accepting" from 12 different browsers in a minute).</summary>
  public string? UserAgent { get; private set; }

  private ClientConsentHistory() { }

  public ClientConsentHistory(
    Guid clientId,
    string policyVersion,
    DateTime acceptedAtUtc,
    string? acceptedFromIp,
    string? userAgent)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");
    if (string.IsNullOrWhiteSpace(policyVersion))
      throw new DomainArgumentException("PolicyVersion can't be null or whitespace.");
    if (policyVersion.Length > 64)
      throw new DomainArgumentException("PolicyVersion length can't exceed 64 chars.");

    Id = Guid.NewGuid();
    ClientId = clientId;
    PolicyVersion = policyVersion.Trim();
    AcceptedAtUtc = acceptedAtUtc.Kind == DateTimeKind.Utc
      ? acceptedAtUtc
      : DateTime.SpecifyKind(acceptedAtUtc, DateTimeKind.Utc);
    AcceptedFromIp = string.IsNullOrWhiteSpace(acceptedFromIp)
      ? null
      : acceptedFromIp.Trim().Length > 64
        ? acceptedFromIp.Trim()[..64]
        : acceptedFromIp.Trim();
    UserAgent = string.IsNullOrWhiteSpace(userAgent)
      ? null
      : userAgent.Trim().Length > 500
        ? userAgent.Trim()[..500]
        : userAgent.Trim();
  }
}
