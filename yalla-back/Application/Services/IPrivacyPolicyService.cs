using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPrivacyPolicyService
{
  /// <summary>Returns the current policy metadata so the frontend
  /// (and Telegram-bot deeplinks) can render and gate consent
  /// independently of any HTTP-only assets.</summary>
  PrivacyPolicyMetaResponse GetCurrent();

  /// <summary>Records the client's acceptance of a given policy
  /// version. Throws <see cref="Yalla.Domain.Exceptions.ClientErrorException"/>
  /// when the supplied version doesn't match
  /// <c>Compliance:PrivacyPolicyCurrentVersion</c> — that ensures we
  /// never persist an acceptance against a policy text the user
  /// didn't actually see.</summary>
  Task AcceptAsync(
    Guid clientId,
    string version,
    string? sourceIp,
    string? userAgent,
    CancellationToken cancellationToken = default);

  /// <summary>True iff the client has accepted the *current* policy
  /// version. False both for "never accepted" and "accepted an older
  /// version" — both states require a fresh accept before any
  /// special-category data flow.</summary>
  Task<bool> HasAcceptedCurrentAsync(
    Guid clientId,
    CancellationToken cancellationToken = default);

  /// <summary>Combined check + version metadata in one round-trip so
  /// the SPA doesn't have to call <c>/me</c> separately to find out
  /// what the client previously accepted.</summary>
  Task<PrivacyPolicyStatusResponse> GetStatusForClientAsync(
    Guid clientId,
    CancellationToken cancellationToken = default);
}
