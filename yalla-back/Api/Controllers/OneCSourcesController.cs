using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Api.Controllers;

[ApiController]
[Route("api/1c/sources")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class OneCSourcesController : ControllerBase
{
  private const string SourceType = "1c";
  private static readonly Regex TokenRegex = new("^[a-z0-9](?:[a-z0-9-]{1,126}[a-z0-9])?$", RegexOptions.Compiled);

  private readonly AppDbContext _db;
  private readonly OneCImportOptions _options;

  public OneCSourcesController(AppDbContext db, IOptions<OneCImportOptions> options)
  {
    _db = db;
    _options = options.Value;
  }

  [HttpGet]
  public async Task<ActionResult<IReadOnlyList<OneCSourceResponse>>> GetAll(CancellationToken cancellationToken)
  {
    var sources = await QuerySources()
      .ToListAsync(cancellationToken);

    return Ok(sources.Select(ToResponse).ToList());
  }

  [HttpPost]
  public async Task<ActionResult<OneCSourceResponse>> Create(
    [FromBody] CreateOneCSourceRequest request,
    CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);
    var token = NormalizeToken(request.Token);
    var name = string.IsNullOrWhiteSpace(request.Name) ? token : request.Name.Trim();

    if (request.PharmacyId == Guid.Empty)
      return BadRequest(new { message = "PharmacyId is required." });

    if (!TokenRegex.IsMatch(token))
      return BadRequest(new { message = "Token должен содержать только латинские буквы, цифры и дефис, например oson-1c." });

    var pharmacy = await _db.Pharmacies
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken);
    if (pharmacy == null)
      return NotFound(new { message = "Аптека не найдена." });

    var tokenExists = await _db.IntegrationSources
      .AnyAsync(x => x.Token == token, cancellationToken);
    if (tokenExists)
      return Conflict(new { message = $"1C token '{token}' уже используется." });

    var source = new IntegrationSource(request.PharmacyId, SourceType, token, name, DateTime.UtcNow);
    _db.IntegrationSources.Add(source);
    await _db.SaveChangesAsync(cancellationToken);

    return Ok(ToResponse(new SourceRow(
      source.Id,
      source.PharmacyId,
      pharmacy.Title,
      source.Token,
      source.Name,
      source.IsActive,
      source.CreatedAtUtc)));
  }

  [HttpPut("{sourceId:guid}")]
  public async Task<ActionResult<OneCSourceResponse>> Update(
    Guid sourceId,
    [FromBody] UpdateOneCSourceRequest request,
    CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var source = await _db.IntegrationSources
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == sourceId && x.Type == SourceType, cancellationToken);
    if (source == null)
      return NotFound(new { message = "1C источник не найден." });

    source.SetName(request.Name);
    source.SetIsActive(request.IsActive);
    await _db.SaveChangesAsync(cancellationToken);

    var row = await QuerySource(sourceId)
      .FirstAsync(cancellationToken);

    return Ok(ToResponse(row));
  }

  [HttpPost("{sourceId:guid}/enable")]
  public Task<ActionResult<OneCSourceResponse>> Enable(Guid sourceId, CancellationToken cancellationToken)
  {
    return SetActive(sourceId, true, cancellationToken);
  }

  [HttpPost("{sourceId:guid}/disable")]
  public Task<ActionResult<OneCSourceResponse>> Disable(Guid sourceId, CancellationToken cancellationToken)
  {
    return SetActive(sourceId, false, cancellationToken);
  }

  [HttpDelete("{sourceId:guid}")]
  public async Task<IActionResult> Delete(Guid sourceId, CancellationToken cancellationToken)
  {
    var source = await _db.IntegrationSources
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == sourceId && x.Type == SourceType, cancellationToken);
    if (source == null)
      return NotFound(new { message = "1C источник не найден." });

    _db.IntegrationSources.Remove(source);
    await _db.SaveChangesAsync(cancellationToken);

    return Ok(new { deleted = true, sourceId });
  }

  private async Task<ActionResult<OneCSourceResponse>> SetActive(
    Guid sourceId,
    bool isActive,
    CancellationToken cancellationToken)
  {
    var source = await _db.IntegrationSources
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == sourceId && x.Type == SourceType, cancellationToken);
    if (source == null)
      return NotFound(new { message = "1C источник не найден." });

    source.SetIsActive(isActive);
    await _db.SaveChangesAsync(cancellationToken);

    var row = await QuerySource(sourceId)
      .FirstAsync(cancellationToken);

    return Ok(ToResponse(row));
  }

  private IQueryable<SourceRow> QuerySources()
  {
    return from source in _db.IntegrationSources.AsNoTracking()
      join pharmacy in _db.Pharmacies.AsNoTracking() on source.PharmacyId equals pharmacy.Id
      where source.Type == SourceType
      orderby pharmacy.Title, source.Name
      select new SourceRow(
        source.Id,
        source.PharmacyId,
        pharmacy.Title,
        source.Token,
        source.Name,
        source.IsActive,
        source.CreatedAtUtc);
  }

  private IQueryable<SourceRow> QuerySource(Guid sourceId)
  {
    return from source in _db.IntegrationSources.AsNoTracking()
      join pharmacy in _db.Pharmacies.AsNoTracking() on source.PharmacyId equals pharmacy.Id
      where source.Type == SourceType && source.Id == sourceId
      select new SourceRow(
        source.Id,
        source.PharmacyId,
        pharmacy.Title,
        source.Token,
        source.Name,
        source.IsActive,
        source.CreatedAtUtc);
  }

  private OneCSourceResponse ToResponse(SourceRow row)
  {
    return new OneCSourceResponse(
      row.Id,
      row.PharmacyId,
      row.PharmacyTitle,
      row.Token,
      row.Name,
      row.IsActive,
      EndpointPath(row.Token),
      row.CreatedAtUtc,
      OneCExchangeStatusReader.Read(_options.ExchangeDirectory, row.Token));
  }

  private static string EndpointPath(string token) => $"/api/1c/exchange/{token}";

  private static string NormalizeToken(string token) => token.Trim().ToLowerInvariant();

  private sealed record SourceRow(
    Guid Id,
    Guid PharmacyId,
    string PharmacyTitle,
    string Token,
    string Name,
    bool IsActive,
    DateTime CreatedAtUtc);
}
