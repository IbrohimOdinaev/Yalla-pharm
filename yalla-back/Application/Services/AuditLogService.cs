using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public interface IAuditLogService
{
  Task<AuditLogPageResponse> QueryAsync(
    GetAuditLogRequest request,
    CancellationToken cancellationToken = default);
}

public sealed class AuditLogService : IAuditLogService
{
  private const int MaxPageSize = 200;

  private readonly IAppDbContext _db;

  public AuditLogService(IAppDbContext db)
  {
    _db = db;
  }

  public async Task<AuditLogPageResponse> QueryAsync(
    GetAuditLogRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var page = request.Page < 1 ? 1 : request.Page;
    var pageSize = request.PageSize switch
    {
      <= 0 => 50,
      > MaxPageSize => MaxPageSize,
      _ => request.PageSize,
    };

    if (request.FromUtc.HasValue && request.ToUtc.HasValue
        && request.FromUtc > request.ToUtc)
      throw new DomainArgumentException("FromUtc can't be greater than ToUtc.");

    var query = _db.AuditLogs.AsNoTracking().AsQueryable();

    if (!string.IsNullOrWhiteSpace(request.EntityType))
    {
      var et = request.EntityType.Trim();
      query = query.Where(x => x.EntityType == et);
    }

    if (request.EntityId.HasValue)
      query = query.Where(x => x.EntityId == request.EntityId.Value);

    if (request.ActorUserId.HasValue)
      query = query.Where(x => x.ActorUserId == request.ActorUserId.Value);

    if (request.Action.HasValue)
      query = query.Where(x => x.Action == request.Action.Value);

    if (request.CorrelationId.HasValue)
      query = query.Where(x => x.CorrelationId == request.CorrelationId.Value);

    if (request.FromUtc.HasValue)
      query = query.Where(x => x.OccurredAtUtc >= request.FromUtc.Value);

    if (request.ToUtc.HasValue)
      query = query.Where(x => x.OccurredAtUtc <= request.ToUtc.Value);

    var totalCount = await query.CountAsync(cancellationToken);

    var items = await query
      .OrderByDescending(x => x.OccurredAtUtc)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .Select(x => new AuditLogEntryResponse
      {
        Id = x.Id,
        OccurredAtUtc = x.OccurredAtUtc,
        ActorUserId = x.ActorUserId,
        ActorRole = x.ActorRole.HasValue ? x.ActorRole.Value.ToString() : null,
        ActorIp = x.ActorIp,
        EntityType = x.EntityType,
        EntityId = x.EntityId,
        Action = x.Action.ToString(),
        Summary = x.Summary,
        PayloadJson = x.PayloadJson,
        CorrelationId = x.CorrelationId,
      })
      .ToListAsync(cancellationToken);

    return new AuditLogPageResponse
    {
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      Items = items,
    };
  }
}
