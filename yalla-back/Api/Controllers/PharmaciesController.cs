using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/pharmacies")]
public sealed class PharmaciesController : ControllerBase
{
  private readonly IPharmacyWorkerService _pharmacyWorkerService;
  private readonly IMedicineImageStorage _imageStorage;
  private readonly IAppDbContext _db;

  public PharmaciesController(
    IPharmacyWorkerService pharmacyWorkerService,
    IMedicineImageStorage imageStorage,
    IAppDbContext db)
  {
    _pharmacyWorkerService = pharmacyWorkerService;
    _imageStorage = imageStorage;
    _db = db;
  }

  [HttpGet]
  [AllowAnonymous]
  public async Task<IActionResult> GetActive(CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.GetActivePharmaciesAsync(cancellationToken);
    return Ok(response);
  }

  [HttpGet("all")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetAll(
    [FromQuery] GetPharmaciesRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.GetPharmaciesAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Register(
    [FromBody] RegisterPharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.RegisterPharmacyAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPut]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> Update(
    [FromBody] UpdatePharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var scopedRequest = request;

    if (role == Role.Admin)
    {
      scopedRequest = new UpdatePharmacyRequest
      {
        PharmacyId = User.GetRequiredPharmacyId(),
        Title = request.Title,
        Address = request.Address,
        AdminId = User.GetRequiredUserId(),
        IsActive = request.IsActive,
        Latitude = request.Latitude,
        Longitude = request.Longitude,
        IconUrl = request.IconUrl,
        BannerUrl = request.BannerUrl
      };
    }

    var response = await _pharmacyWorkerService.UpdatePharmacyAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpDelete]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Delete(
    [FromBody] DeletePharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.DeletePharmacyAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("icon")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> UploadIcon(
    [FromForm] Guid pharmacyId,
    [FromForm] IFormFile image,
    CancellationToken cancellationToken)
  {
    if (image is null || image.Length <= 0)
      throw new InvalidOperationException("Image file is required.");

    if (image.Length > 5 * 1024 * 1024)
      throw new InvalidOperationException("Icon file is too large. Maximum 5 MB.");

    var pharmacy = await _db.Pharmacies.FindAsync([pharmacyId], cancellationToken)
      ?? throw new InvalidOperationException("Pharmacy not found.");

    // Delete old icon if exists
    if (!string.IsNullOrEmpty(pharmacy.IconUrl))
    {
      try { await _imageStorage.DeleteAsync(pharmacy.IconUrl, cancellationToken); }
      catch { /* ignore */ }
    }

    var contentType = string.IsNullOrWhiteSpace(image.ContentType) ? "application/octet-stream" : image.ContentType;
    using var stream = image.OpenReadStream();
    var key = await _imageStorage.UploadAsync(stream, contentType, $"pharmacy-icon-{pharmacyId}{Path.GetExtension(image.FileName)}", cancellationToken);

    pharmacy.SetIconUrl(key);
    await _db.SaveChangesAsync(cancellationToken);

    return Ok(new { iconUrl = key });
  }

  [HttpGet("icon/{pharmacyId:guid}/content")]
  [AllowAnonymous]
  public async Task<IActionResult> GetIconContent(Guid pharmacyId, CancellationToken cancellationToken)
  {
    var pharmacy = await _db.Pharmacies.FindAsync([pharmacyId], cancellationToken)
      ?? throw new InvalidOperationException("Pharmacy not found.");

    if (string.IsNullOrEmpty(pharmacy.IconUrl))
      return NotFound();

    // ETag = the MinIO storage key. Each re-upload mints a new key, so the
    // ETag changes only when the icon actually changes; browsers/CDN can
    // revalidate cheaply without re-streaming the bytes.
    var etag = $"\"{pharmacy.IconUrl}\"";
    if (Request.Headers.TryGetValue("If-None-Match", out var inm) && inm.ToString() == etag)
    {
      Response.Headers.ETag = etag;
      Response.Headers.CacheControl = "public, max-age=300, must-revalidate";
      return StatusCode(StatusCodes.Status304NotModified);
    }

    var content = await _imageStorage.GetContentAsync(pharmacy.IconUrl, cancellationToken);
    Response.Headers.ETag = etag;
    Response.Headers.CacheControl = "public, max-age=300, must-revalidate";
    return File(content.Content, content.ContentType);
  }

  [HttpDelete("icon")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> DeleteIcon(
    [FromBody] DeletePharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var pharmacy = await _db.Pharmacies.FindAsync([request.PharmacyId], cancellationToken)
      ?? throw new InvalidOperationException("Pharmacy not found.");

    if (!string.IsNullOrEmpty(pharmacy.IconUrl))
    {
      try { await _imageStorage.DeleteAsync(pharmacy.IconUrl, cancellationToken); }
      catch { /* ignore */ }
      pharmacy.SetIconUrl(null);
      await _db.SaveChangesAsync(cancellationToken);
    }

    return Ok(new { deleted = true });
  }

  [HttpPost("banner")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> UploadBanner(
    [FromForm] Guid pharmacyId,
    [FromForm] IFormFile image,
    CancellationToken cancellationToken)
  {
    if (image is null || image.Length <= 0)
      throw new InvalidOperationException("Image file is required.");

    if (image.Length > 10 * 1024 * 1024)
      throw new InvalidOperationException("Banner file is too large. Maximum 10 MB.");

    var role = User.GetRequiredRole();
    var targetPharmacyId = role == Role.Admin ? User.GetRequiredPharmacyId() : pharmacyId;

    var pharmacy = await _db.Pharmacies.FindAsync([targetPharmacyId], cancellationToken)
      ?? throw new InvalidOperationException("Pharmacy not found.");

    if (!string.IsNullOrEmpty(pharmacy.BannerUrl) && !pharmacy.BannerUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
    {
      try { await _imageStorage.DeleteAsync(pharmacy.BannerUrl, cancellationToken); }
      catch { /* ignore */ }
    }

    var contentType = string.IsNullOrWhiteSpace(image.ContentType) ? "application/octet-stream" : image.ContentType;
    using var stream = image.OpenReadStream();
    var key = await _imageStorage.UploadAsync(stream, contentType, $"pharmacy-banner-{targetPharmacyId}{Path.GetExtension(image.FileName)}", cancellationToken);

    pharmacy.SetBannerUrl(key);
    await _db.SaveChangesAsync(cancellationToken);

    return Ok(new { bannerUrl = key });
  }

  [HttpGet("banner/{pharmacyId:guid}/content")]
  [AllowAnonymous]
  public async Task<IActionResult> GetBannerContent(Guid pharmacyId, CancellationToken cancellationToken)
  {
    var pharmacy = await _db.Pharmacies.FindAsync([pharmacyId], cancellationToken)
      ?? throw new InvalidOperationException("Pharmacy not found.");

    if (string.IsNullOrEmpty(pharmacy.BannerUrl))
      return NotFound();

    // External URL — let client fetch directly
    if (pharmacy.BannerUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
      return Redirect(pharmacy.BannerUrl);

    var etag = $"\"{pharmacy.BannerUrl}\"";
    if (Request.Headers.TryGetValue("If-None-Match", out var inm) && inm.ToString() == etag)
    {
      Response.Headers.ETag = etag;
      Response.Headers.CacheControl = "public, max-age=300, must-revalidate";
      return StatusCode(StatusCodes.Status304NotModified);
    }

    var content = await _imageStorage.GetContentAsync(pharmacy.BannerUrl, cancellationToken);
    Response.Headers.ETag = etag;
    Response.Headers.CacheControl = "public, max-age=300, must-revalidate";
    return File(content.Content, content.ContentType);
  }

  [HttpDelete("banner")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> DeleteBanner(
    [FromBody] DeletePharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var targetPharmacyId = role == Role.Admin ? User.GetRequiredPharmacyId() : request.PharmacyId;

    var pharmacy = await _db.Pharmacies.FindAsync([targetPharmacyId], cancellationToken)
      ?? throw new InvalidOperationException("Pharmacy not found.");

    if (!string.IsNullOrEmpty(pharmacy.BannerUrl))
    {
      if (!pharmacy.BannerUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
      {
        try { await _imageStorage.DeleteAsync(pharmacy.BannerUrl, cancellationToken); }
        catch { /* ignore */ }
      }
      pharmacy.SetBannerUrl(null);
      await _db.SaveChangesAsync(cancellationToken);
    }

    return Ok(new { deleted = true });
  }
}
