using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PrivacyPolicyService : IPrivacyPolicyService
{
  private readonly IAppDbContext _db;
  private readonly ComplianceOptions _options;
  private readonly IAuditLogger? _auditLogger;

  public PrivacyPolicyService(
    IAppDbContext db,
    IOptions<ComplianceOptions> options,
    IAuditLogger? auditLogger = null)
  {
    ArgumentNullException.ThrowIfNull(db);
    ArgumentNullException.ThrowIfNull(options);
    _db = db;
    _options = options.Value;
    _auditLogger = auditLogger;
  }

  public PrivacyPolicyMetaResponse GetCurrent() => new()
  {
    Version = ResolveCurrentVersion(),
    EffectiveDate = _options.PrivacyPolicyEffectiveDate ?? string.Empty,
  };

  public async Task AcceptAsync(
    Guid clientId,
    string version,
    string? sourceIp,
    string? userAgent,
    CancellationToken cancellationToken = default)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");
    if (string.IsNullOrWhiteSpace(version))
      throw new DomainArgumentException("Version can't be null or whitespace.");

    var current = ResolveCurrentVersion();
    if (!string.Equals(current, version.Trim(), StringComparison.Ordinal))
      throw new ClientErrorException(
        errorCode: "privacy_policy_version_mismatch",
        detail: $"Принимать можно только текущую версию политики ({current}).",
        reason: "version_mismatch",
        statusCode: 400);

    var client = await _db.Clients
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == clientId, cancellationToken)
      ?? throw new ClientErrorException(
        errorCode: "client_not_found",
        detail: "Клиент не найден.",
        reason: "client_not_found",
        statusCode: 404);

    var now = DateTime.UtcNow;
    client.AcceptPrivacyPolicy(current, now, sourceIp);

    // Append-only history row — required by Закон РТ № 1537 for audit.
    // Even if Client.* fields get over-written by a later acceptance,
    // the ledger preserves every prior version + timestamp + IP.
    _db.ClientConsentHistory.Add(new ClientConsentHistory(
      clientId: client.Id,
      policyVersion: current,
      acceptedAtUtc: now,
      acceptedFromIp: sourceIp,
      userAgent: userAgent));

    if (_auditLogger is not null)
    {
      await _auditLogger.LogAsync(
        AuditAction.Updated,
        entityType: "Client",
        entityId: client.Id,
        summary: $"Privacy policy {current} accepted by client {client.Id}.",
        payload: new { version = current, ip = sourceIp },
        cancellationToken: cancellationToken);
    }

    await _db.SaveChangesAsync(cancellationToken);
  }

  public async Task<bool> HasAcceptedCurrentAsync(
    Guid clientId,
    CancellationToken cancellationToken = default)
  {
    if (clientId == Guid.Empty) return false;
    var current = ResolveCurrentVersion();

    var accepted = await _db.Clients
      .AsNoTracking()
      .Where(x => x.Id == clientId)
      .Select(x => x.PrivacyPolicyVersionAccepted)
      .FirstOrDefaultAsync(cancellationToken);

    return !string.IsNullOrEmpty(accepted)
      && string.Equals(accepted, current, StringComparison.Ordinal);
  }

  public async Task<PrivacyPolicyStatusResponse> GetStatusForClientAsync(
    Guid clientId,
    CancellationToken cancellationToken = default)
  {
    var current = ResolveCurrentVersion();
    var accepted = clientId == Guid.Empty
      ? null
      : await _db.Clients
        .AsNoTracking()
        .Where(x => x.Id == clientId)
        .Select(x => x.PrivacyPolicyVersionAccepted)
        .FirstOrDefaultAsync(cancellationToken);

    return new PrivacyPolicyStatusResponse
    {
      Accepted = !string.IsNullOrEmpty(accepted)
        && string.Equals(accepted, current, StringComparison.Ordinal),
      AcceptedVersion = accepted,
      CurrentVersion = current,
    };
  }

  private string ResolveCurrentVersion()
  {
    var v = _options.PrivacyPolicyCurrentVersion;
    if (string.IsNullOrWhiteSpace(v))
      throw new InvalidOperationException(
        "Compliance:PrivacyPolicyCurrentVersion is not configured. "
        + "Set it in appsettings.json — otherwise the privacy gate is "
        + "fail-open, which is unsafe.");
    return v.Trim();
  }
}
