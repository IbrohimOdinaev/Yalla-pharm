using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

/// <summary>
/// Manual-item lookup workflow: a pharmacist asks every pharmacy admin to
/// physically locate an out-of-catalog medicine; admins respond with
/// price/qty/photo. Routes split into pharmacist and admin sections — the
/// image-content endpoint is auth-gated but role-agnostic so both sides
/// can render the photo.
/// </summary>
[ApiController]
[Route("api/manual-lookups")]
public sealed class ManualLookupsController : ControllerBase
{
    private readonly IManualItemLookupService _service;
    private readonly IManualLookupImageStorage _imageStorage;
    private readonly IAppDbContext _dbContext;

    public ManualLookupsController(
      IManualItemLookupService service,
      IManualLookupImageStorage imageStorage,
      IAppDbContext dbContext)
    {
        _service = service;
        _imageStorage = imageStorage;
        _dbContext = dbContext;
    }

    // ── Pharmacist ───────────────────────────────────────────────────────

    [HttpPost]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> Create(
      [FromBody] CreateManualLookupRequest request,
      CancellationToken cancellationToken)
    {
        var pharmacistId = User.GetRequiredUserId();
        var response = await _service.CreateRequestAsync(pharmacistId, request, cancellationToken);
        return Ok(response);
    }

    [HttpGet("by-prescription/{prescriptionId:guid}")]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> GetByPrescription(
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        var pharmacistId = User.GetRequiredUserId();
        var response = await _service.GetByPrescriptionForPharmacistAsync(
          pharmacistId, prescriptionId, cancellationToken);
        return Ok(response);
    }

    [HttpGet("{requestId:guid}")]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> GetById(
      Guid requestId,
      CancellationToken cancellationToken)
    {
        var pharmacistId = User.GetRequiredUserId();
        var response = await _service.GetByIdForPharmacistAsync(
          pharmacistId, requestId, cancellationToken);
        return Ok(response);
    }

    // ── Admin ────────────────────────────────────────────────────────────

    [HttpGet("admin/active")]
    [Authorize(Roles = nameof(Role.Admin))]
    public async Task<IActionResult> GetActive(CancellationToken cancellationToken)
    {
        var adminId = User.GetRequiredUserId();
        var response = await _service.GetActiveForAdminAsync(adminId, cancellationToken);
        return Ok(response);
    }

    [HttpGet("admin/history")]
    [Authorize(Roles = nameof(Role.Admin))]
    public async Task<IActionResult> GetHistory(
      [FromQuery] int page = 1,
      [FromQuery] int pageSize = 50,
      CancellationToken cancellationToken = default)
    {
        var adminId = User.GetRequiredUserId();
        var response = await _service.GetHistoryForAdminAsync(
          adminId,
          new GetManualLookupHistoryRequest { Page = page, PageSize = pageSize },
          cancellationToken);
        return Ok(response);
    }

    [HttpGet("admin/{requestId:guid}/my-response")]
    [Authorize(Roles = nameof(Role.Admin))]
    public async Task<IActionResult> GetMyResponse(
      Guid requestId,
      CancellationToken cancellationToken)
    {
        var adminId = User.GetRequiredUserId();
        var response = await _service.GetMyResponseAsync(adminId, requestId, cancellationToken);
        if (response is null)
            return NotFound();
        return Ok(response);
    }

    /// <summary>
    /// Multipart upsert of the responding pharmacy's answer. Form fields
    /// (`fullName`, `price`, `quantity`, `responseComment`, `clearImage`)
    /// arrive on the DTO; the optional photo is read from
    /// <c>Request.Form.Files</c> directly (the complex-DTO binder is
    /// greedy and would otherwise eat the file field).
    /// </summary>
    [HttpPost("admin/{requestId:guid}/respond")]
    [Authorize(Roles = nameof(Role.Admin))]
    [RequestSizeLimit(UserInputPolicy.MaxMedicineImageFileSizeBytes)]
    public async Task<IActionResult> Respond(
      Guid requestId,
      [FromForm] RespondToManualLookupRequest request,
      CancellationToken cancellationToken)
    {
        var adminId = User.GetRequiredUserId();

        var photoFile = Request.Form.Files
          .FirstOrDefault(f => string.Equals(f.Name, "photo", StringComparison.OrdinalIgnoreCase))
          ?? Request.Form.Files.FirstOrDefault();

        ManualLookupImageUpload? upload = null;
        Stream? openedStream = null;
        try
        {
            if (photoFile is { Length: > 0 })
            {
                openedStream = photoFile.OpenReadStream();
                upload = new ManualLookupImageUpload
                {
                    Content = openedStream,
                    FileName = photoFile.FileName,
                    ContentType = string.IsNullOrWhiteSpace(photoFile.ContentType)
                      ? "application/octet-stream"
                      : photoFile.ContentType,
                    Length = photoFile.Length
                };
            }

            var response = await _service.RespondAsync(
              adminId, requestId, request, upload, cancellationToken);
            return Ok(response);
        }
        finally
        {
            openedStream?.Dispose();
        }
    }

    // ── Image content (anonymous-but-auth-gated) ────────────────────────

    /// <summary>
    /// Auth-gated content stream for a response's optional photo. Visible
    /// to: SuperAdmin, the responding admin's pharmacy (any of its
    /// admins), and the originating pharmacist (so they can review what
    /// the pharmacy sent). Other clients/admins/pharmacists are denied —
    /// the photo can leak shelf details.
    /// </summary>
    [HttpGet("responses/{responseId:guid}/image")]
    [Authorize]
    public async Task<IActionResult> GetResponseImage(
      Guid responseId,
      CancellationToken cancellationToken)
    {
        var role = User.GetRequiredRole();
        var userId = User.GetRequiredUserId();

        var meta = await _dbContext.ManualItemLookupResponses
          .AsNoTracking()
          .Where(r => r.Id == responseId)
          .Select(r => new
          {
              r.ImageKey,
              r.RespondingPharmacyId,
              RequestedByPharmacistId = _dbContext.ManualItemLookupRequests
                .Where(req => req.Id == r.RequestId)
                .Select(req => req.RequestedByPharmacistId)
                .FirstOrDefault()
          })
          .FirstOrDefaultAsync(cancellationToken);

        if (meta is null || string.IsNullOrEmpty(meta.ImageKey))
            return NotFound();

        bool allowed;
        switch (role)
        {
            case Role.SuperAdmin:
                allowed = true;
                break;
            case Role.Pharmacist:
                allowed = meta.RequestedByPharmacistId == userId;
                break;
            case Role.Admin:
                // Any admin of the responding pharmacy can see the photo.
                var pharmacyId = User.GetRequiredPharmacyId();
                allowed = pharmacyId == meta.RespondingPharmacyId;
                break;
            default:
                allowed = false;
                break;
        }

        if (!allowed)
            return Forbid();

        var content = await _imageStorage.GetContentAsync(meta.ImageKey, cancellationToken);
        return File(content.Content, content.ContentType);
    }
}
