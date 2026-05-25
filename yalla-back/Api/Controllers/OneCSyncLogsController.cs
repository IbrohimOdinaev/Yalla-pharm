using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Api.Controllers;

[ApiController]
[Route("api/1c/sync-logs")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class OneCSyncLogsController : ControllerBase
{
  private readonly AppDbContext _db;
  private readonly OneCImportOptions _options;

  public OneCSyncLogsController(AppDbContext db, IOptions<OneCImportOptions> options)
  {
    _db = db;
    _options = options.Value;
  }

  [HttpGet]
  public async Task<ActionResult<OneCSyncLogsResponse>> Get(CancellationToken cancellationToken)
  {
    var sources = await (
      from source in _db.IntegrationSources.AsNoTracking()
      join pharmacy in _db.Pharmacies.AsNoTracking() on source.PharmacyId equals pharmacy.Id
      where source.Type == "1c"
      orderby pharmacy.Title, source.Name
      select new SourceRow(
        source.Id,
        source.PharmacyId,
        source.Token,
        source.Name,
        pharmacy.Title,
        source.IsActive))
      .ToListAsync(cancellationToken);

    var sourceIds = sources.Select(x => x.SourceId).ToArray();
    if (sourceIds.Length == 0)
      return Ok(new OneCSyncLogsResponse([], [], []));

    var runs = await _db.OneCImportRuns
      .AsNoTracking()
      .Where(x => sourceIds.Contains(x.SourceId))
      .OrderByDescending(x => x.StartedAtUtc)
      .Take(500)
      .ToListAsync(cancellationToken);

    var linkStats = await _db.ExternalProductLinks
      .AsNoTracking()
      .Where(x => sourceIds.Contains(x.SourceId))
      .GroupBy(x => new { x.SourceId, x.MatchStatus, x.MatchMethod })
      .Select(x => new LinkStat(x.Key.SourceId, x.Key.MatchStatus, x.Key.MatchMethod, x.Count()))
      .ToListAsync(cancellationToken);

    var catalogLinkedMedicines = await _db.ExternalProductLinks
      .AsNoTracking()
      .Where(x => sourceIds.Contains(x.SourceId) && x.MedicineId.HasValue)
      .GroupBy(x => x.SourceId)
      .Select(x => new { SourceId = x.Key, Count = x.Select(y => y.MedicineId!.Value).Distinct().Count() })
      .ToDictionaryAsync(x => x.SourceId, x => x.Count, cancellationToken);

    var sourceById = sources.ToDictionary(x => x.SourceId);
    var runLogs = runs
      .Select(run => ToRunLog(sourceById[run.SourceId], run))
      .ToList();

    var nomenclatureXml = RecentBySourceAndKind(runLogs, sourceIds, "import");
    var offersXml = RecentBySourceAndKind(runLogs, sourceIds, "offers");

    var sourceStatuses = sources
      .Select(source =>
      {
        var stats = linkStats.Where(x => x.SourceId == source.SourceId).ToList();
        return new OneCSourceSyncStatusResponse(
          source.SourceId,
          source.PharmacyId,
          source.SourceToken,
          source.SourceName,
          source.PharmacyTitle,
          source.IsActive,
          $"/api/1c/exchange/{source.SourceToken}",
          OneCExchangeStatusReader.Read(_options.ExchangeDirectory, source.SourceToken),
          stats.Sum(x => x.Count),
          catalogLinkedMedicines.GetValueOrDefault(source.SourceId),
          stats.Where(x => x.MatchStatus == "auto_matched").Sum(x => x.Count),
          stats.Where(x => x.MatchStatus == "confirmed").Sum(x => x.Count),
          stats.Where(x => x.MatchStatus == "manual_required").Sum(x => x.Count),
          stats.Where(x => x.MatchMethod == "missing_barcode").Sum(x => x.Count),
          stats.Where(x => x.MatchMethod == "barcode_not_found_or_not_unique").Sum(x => x.Count),
          runLogs.FirstOrDefault(x => x.SourceId == source.SourceId && x.FileKind == "import"),
          runLogs.FirstOrDefault(x => x.SourceId == source.SourceId && x.FileKind == "offers"));
      })
      .ToList();

    return Ok(new OneCSyncLogsResponse(sourceStatuses, nomenclatureXml, offersXml));
  }

  private static IReadOnlyList<OneCImportRunLogResponse> RecentBySourceAndKind(
    IReadOnlyList<OneCImportRunLogResponse> runs,
    IReadOnlyList<Guid> sourceIds,
    string kind)
  {
    return sourceIds
      .SelectMany(sourceId => runs
        .Where(x => x.SourceId == sourceId && x.FileKind == kind)
        .OrderByDescending(x => x.StartedAtUtc)
        .Take(3))
      .OrderByDescending(x => x.StartedAtUtc)
      .ToList();
  }

  private static OneCImportRunLogResponse ToRunLog(SourceRow source, Yalla.Domain.Entities.OneCImportRun run)
  {
    return new OneCImportRunLogResponse(
      run.Id,
      run.SourceId,
      source.PharmacyId,
      source.SourceToken,
      source.SourceName,
      source.PharmacyTitle,
      run.FileKind,
      run.FileName,
      run.FileSize,
      run.Status,
      run.ProcessedCount,
      run.LinkedCount,
      run.UpdatedCount,
      run.InsertedCount,
      run.UnchangedCount,
      run.UnmatchedCount,
      run.Error,
      run.StartedAtUtc,
      run.FinishedAtUtc);
  }

  private sealed record SourceRow(
    Guid SourceId,
    Guid PharmacyId,
    string SourceToken,
    string SourceName,
    string PharmacyTitle,
    bool IsActive);

  private sealed record LinkStat(Guid SourceId, string MatchStatus, string MatchMethod, int Count);
}
