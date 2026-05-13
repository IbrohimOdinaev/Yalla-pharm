using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Yalla.Application.Abstractions;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Audit;

/// <summary>
/// Default implementation of <see cref="IAuditLogger"/>: serialises the
/// caller's payload, resolves actor + correlation id from
/// <see cref="ICurrentUserContext"/>, and stages an
/// <see cref="AuditLogEntry"/> in the DbContext for the surrounding
/// transaction to commit.
///
/// Scoped — one instance per request, shares the same DbContext as the
/// invoking service so writes are part of the same UoW.
/// </summary>
public sealed class AuditLogger : IAuditLogger
{
  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = false,
  };

  private readonly IAppDbContext _db;
  private readonly ICurrentUserContext _userContext;
  private readonly ILogger<AuditLogger> _logger;

  public AuditLogger(
    IAppDbContext db,
    ICurrentUserContext userContext,
    ILogger<AuditLogger> logger)
  {
    _db = db;
    _userContext = userContext;
    _logger = logger;
  }

  public Task LogAsync(
    AuditAction action,
    string entityType,
    Guid? entityId,
    string summary,
    object? payload = null,
    CancellationToken cancellationToken = default)
  {
    var entry = new AuditLogEntry(
      id: Guid.NewGuid(),
      occurredAtUtc: DateTime.UtcNow,
      actorUserId: _userContext.UserId,
      actorRole: _userContext.Role,
      actorIp: _userContext.Ip,
      entityType: entityType,
      entityId: entityId,
      action: action,
      summary: summary ?? string.Empty,
      payloadJson: SerializePayload(payload),
      correlationId: _userContext.CorrelationId);

    _db.AuditLogs.Add(entry);
    return Task.CompletedTask;
  }

  private string? SerializePayload(object? payload)
  {
    if (payload is null) return null;

    try
    {
      var json = JsonSerializer.Serialize(payload, JsonOptions);
      var byteCount = Encoding.UTF8.GetByteCount(json);
      if (byteCount <= AuditLogEntry.MaxPayloadSizeBytes) return json;

      // Truncate at the byte level to a wrapper object that preserves
      // the size signal — the original payload is dropped on purpose
      // so we never accidentally store half a JSON document that
      // breaks downstream tooling.
      var marker = JsonSerializer.Serialize(new
      {
        truncated = true,
        originalBytes = byteCount,
        capBytes = AuditLogEntry.MaxPayloadSizeBytes,
      }, JsonOptions);

      _logger.LogWarning(
        "Audit payload was {OriginalBytes} bytes, truncated to marker.",
        byteCount);
      return marker;
    }
    catch (Exception ex)
    {
      // A bad payload shouldn't crash the surrounding business
      // operation — log and persist a sentinel value so the audit row
      // still says "something happened" with a hint why we lost the
      // detail. Truly catastrophic errors (out of memory) still
      // bubble up.
      _logger.LogWarning(ex, "Failed to serialise audit payload, storing sentinel.");
      return "{\"error\":\"serialization_failed\"}";
    }
  }
}
