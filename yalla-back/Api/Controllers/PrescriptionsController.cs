using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/prescriptions")]
public sealed class PrescriptionsController : ControllerBase
{
    private readonly IPrescriptionService _prescriptionService;
    private readonly IPrescriptionImageStorage _imageStorage;
    private readonly IAppDbContext _dbContext;

    public PrescriptionsController(
      IPrescriptionService prescriptionService,
      IPrescriptionImageStorage imageStorage,
      IAppDbContext dbContext)
    {
        _prescriptionService = prescriptionService;
        _imageStorage = imageStorage;
        _dbContext = dbContext;
    }

    /// <summary>
    /// Client uploads 1–2 prescription photos + patient age + optional comment.
    /// Returns the freshly-created prescription record (status=Submitted).
    ///
    /// We read the files via <c>Request.Form.Files</c> instead of binding
    /// them to a controller parameter because the complex-type
    /// <see cref="CreatePrescriptionRequest"/> binder is greedy and eats
    /// every multipart field, including the photo files (they end up
    /// nowhere). Reading the IFormFileCollection directly side-steps that.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = nameof(Role.Client))]
    [RequestSizeLimit(UserInputPolicy.MaxMedicineImageFileSizeBytes * Prescription.MaxImagesPerPrescription)]
    public async Task<IActionResult> Create(
      [FromForm] CreatePrescriptionRequest request,
      CancellationToken cancellationToken)
    {
        var photoFiles = Request.Form.Files
          .Where(f => string.Equals(f.Name, "photos", StringComparison.OrdinalIgnoreCase))
          .ToList();

        // Fall back to "every uploaded file" so older clients that didn't
        // name the field "photos" still work. Saves one round-trip of the
        // user re-trying after the form encoder ate the field name.
        if (photoFiles.Count == 0 && Request.Form.Files.Count > 0)
            photoFiles = Request.Form.Files.ToList();

        if (photoFiles.Count == 0)
            throw new InvalidOperationException("At least one photo is required.");

        if (photoFiles.Count > Prescription.MaxImagesPerPrescription)
            throw new InvalidOperationException(
              $"At most {Prescription.MaxImagesPerPrescription} photos are allowed per prescription.");

        var clientId = User.GetRequiredUserId();

        var uploads = new List<PrescriptionImageUpload>(photoFiles.Count);
        var openedStreams = new List<Stream>(photoFiles.Count);
        try
        {
            foreach (var file in photoFiles)
            {
                if (file is null || file.Length <= 0)
                    throw new InvalidOperationException("Photo is empty.");

                var stream = file.OpenReadStream();
                openedStreams.Add(stream);

                uploads.Add(new PrescriptionImageUpload
                {
                    Content = stream,
                    FileName = file.FileName,
                    ContentType = string.IsNullOrWhiteSpace(file.ContentType)
                      ? "application/octet-stream"
                      : file.ContentType,
                    Length = file.Length
                });
            }

            var response = await _prescriptionService.CreatePrescriptionAsync(
              clientId,
              request,
              uploads,
              cancellationToken);

            return Ok(response);
        }
        finally
        {
            foreach (var stream in openedStreams)
                stream.Dispose();
        }
    }

    /// <summary>Listing of the calling client's own prescriptions.</summary>
    [HttpGet("me")]
    [Authorize(Roles = nameof(Role.Client))]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var clientId = User.GetRequiredUserId();
        var response = await _prescriptionService.GetMyPrescriptionsAsync(clientId, cancellationToken);
        return Ok(response);
    }

    // ── SuperAdmin ────────────────────────────────────────────────────────

    /// <summary>SuperAdmin queue of prescriptions waiting for the 3 TJS sign-off.</summary>
    [HttpGet("superadmin/awaiting-confirmation")]
    [Authorize(Roles = nameof(Role.SuperAdmin))]
    public async Task<IActionResult> GetAwaitingConfirmation(CancellationToken cancellationToken)
    {
        var response = await _prescriptionService.GetAwaitingConfirmationAsync(cancellationToken);
        return Ok(response);
    }

    /// <summary>SuperAdmin marks the 3 TJS as paid → prescription enters the pharmacist queue.</summary>
    [HttpPost("superadmin/{prescriptionId:guid}/confirm")]
    [Authorize(Roles = nameof(Role.SuperAdmin))]
    public async Task<IActionResult> ConfirmPayment(
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        var response = await _prescriptionService.ConfirmPaymentAsync(prescriptionId, cancellationToken);
        return Ok(response);
    }

    // ── Pharmacist ────────────────────────────────────────────────────────

    /// <summary>The shared in-queue pool every pharmacist sees.</summary>
    [HttpGet("pharmacist/queue")]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> GetPharmacistQueue(CancellationToken cancellationToken)
    {
        var response = await _prescriptionService.GetPharmacistQueueAsync(cancellationToken);
        return Ok(response);
    }

    /// <summary>Single prescription detail from the pharmacist viewpoint.</summary>
    [HttpGet("pharmacist/{prescriptionId:guid}")]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> GetForPharmacist(
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        var pharmacistId = User.GetRequiredUserId();
        var response = await _prescriptionService.GetForPharmacistAsync(
          pharmacistId,
          prescriptionId,
          cancellationToken);
        return Ok(response);
    }

    /// <summary>Pharmacist takes a prescription into review → InReview, assigned to them.</summary>
    [HttpPost("pharmacist/{prescriptionId:guid}/take")]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> TakeIntoReview(
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        var pharmacistId = User.GetRequiredUserId();
        var response = await _prescriptionService.TakeIntoReviewAsync(
          pharmacistId,
          prescriptionId,
          cancellationToken);
        return Ok(response);
    }

    /// <summary>Pharmacist submits the decoded checklist (catalog refs + manual entries).</summary>
    [HttpPost("pharmacist/{prescriptionId:guid}/decode")]
    [Authorize(Roles = nameof(Role.Pharmacist))]
    public async Task<IActionResult> SubmitChecklist(
      Guid prescriptionId,
      [FromBody] DecodePrescriptionRequest request,
      CancellationToken cancellationToken)
    {
        var pharmacistId = User.GetRequiredUserId();
        var response = await _prescriptionService.SubmitChecklistAsync(
          pharmacistId,
          prescriptionId,
          request,
          cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Anonymous content endpoint mirrors <c>GET /api/medicines/images/{id}/content</c>.
    /// Auth-gated to the client who owns the prescription so other people can't
    /// fish for sensitive medical data by guessing image ids.
    /// </summary>
    [HttpGet("images/{prescriptionImageId:guid}/content")]
    [Authorize]
    public async Task<IActionResult> GetImageContent(
      Guid prescriptionImageId,
      CancellationToken cancellationToken)
    {
        var role = User.GetRequiredRole();
        var userId = User.GetRequiredUserId();

        var image = await _dbContext.PrescriptionImages
          .AsNoTracking()
          .Where(x => x.Id == prescriptionImageId)
          .Select(x => new
          {
              x.Key,
              PrescriptionClientId = _dbContext.Prescriptions
                .Where(p => p.Id == x.PrescriptionId)
                .Select(p => p.ClientId)
                .FirstOrDefault(),
              PrescriptionAssignedPharmacistId = _dbContext.Prescriptions
                .Where(p => p.Id == x.PrescriptionId)
                .Select(p => p.AssignedPharmacistId)
                .FirstOrDefault()
          })
          .FirstOrDefaultAsync(cancellationToken);

        if (image is null)
            return NotFound();

        // Owner client always allowed; SuperAdmin always allowed; assigned
        // pharmacist allowed for the duration of the review.
        var allowed = role switch
        {
            Role.SuperAdmin => true,
            Role.Client => image.PrescriptionClientId == userId,
            Role.Pharmacist => image.PrescriptionAssignedPharmacistId == userId,
            _ => false
        };

        if (!allowed)
            return Forbid();

        var content = await _imageStorage.GetContentAsync(image.Key, cancellationToken);
        return File(content.Content, content.ContentType);
    }
}
