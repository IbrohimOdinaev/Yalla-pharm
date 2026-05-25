using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/admins")]
public sealed class AdminsController : ControllerBase
{
  private readonly IAuthService _authService;
  private readonly IPharmacyWorkerService _pharmacyWorkerService;
  private readonly IAppDbContext _db;
  private readonly IMedicineImageStorage _imageStorage;

  public AdminsController(
    IAuthService authService,
    IPharmacyWorkerService pharmacyWorkerService,
    IAppDbContext db,
    IMedicineImageStorage imageStorage)
  {
    _authService = authService;
    _pharmacyWorkerService = pharmacyWorkerService;
    _db = db;
    _imageStorage = imageStorage;
  }

  [HttpGet]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetAll(
    [FromQuery] GetAdminsRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.GetAdminsAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("register")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Register(
    [FromBody] RegisterPharmacyWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.RegisterPharmacyWorkerAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("register-with-pharmacy")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> RegisterWithPharmacy(
    [FromBody] RegisterAdminWithPharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.RegisterAdminWithPharmacyAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpDelete]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Delete(
    [FromBody] DeletePharmacyWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.DeletePharmacyWorkerAsync(request, cancellationToken);
    return Ok(response);
  }

  /// <summary>
  /// Mark a pharmacy admin inactive. Login is rejected immediately;
  /// already-issued tokens stop working within ~60s. Open orders in
  /// Preparing are NOT auto-reassigned — the response carries a
  /// warning + count so the SuperAdmin can re-route those manually.
  /// </summary>
  [HttpPost("{workerId:guid}/deactivate")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Deactivate(
    Guid workerId,
    [FromBody] DeactivateUserRequest request,
    [FromServices] IUserActivationChecker activationChecker,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _pharmacyWorkerService.DeactivatePharmacyWorkerAsync(
      workerId, superAdminId, request, cancellationToken);
    // Drop the cached "active" entry so the very next request from
    // the deactivated user fails immediately, not after the TTL.
    activationChecker.Invalidate(workerId);
    return Ok(response);
  }

  [HttpPost("{workerId:guid}/activate")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Activate(
    Guid workerId,
    [FromServices] IUserActivationChecker activationChecker,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var response = await _pharmacyWorkerService.ActivatePharmacyWorkerAsync(
      workerId, superAdminId, cancellationToken);
    activationChecker.Invalidate(workerId);
    return Ok(response);
  }

  [HttpPut("me")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> UpdateMyProfile(
    [FromBody] UpdateAdminProfileRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _authService.UpdateAdminProfileAsync(adminId, request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("me")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetMyProfile(CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var admin = await _db.Users
      .AsNoTracking()
      .Where(x => x.Id == adminId && x.Role == Role.Admin)
      .Select(x => new
      {
        name = x.Name,
        phoneNumber = x.PhoneNumber,
        avatarUrl = x.AvatarUrl == null ? null : "/api/admins/me/avatar/content"
      })
      .FirstOrDefaultAsync(cancellationToken)
      ?? throw new InvalidOperationException("Admin user was not found.");

    return Ok(admin);
  }

  [HttpPost("me/otp/request")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> RequestMyProfileOtp(
    [FromBody] RequestAdminProfileUpdateOtpRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _authService.RequestAdminProfileUpdateOtpAsync(adminId, request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("me/otp/verify")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> VerifyMyProfileOtp(
    [FromBody] VerifyAdminProfileUpdateOtpRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _authService.VerifyAdminProfileUpdateOtpAsync(adminId, request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("me/avatar")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> UploadMyAvatar(
    [FromForm] IFormFile image,
    CancellationToken cancellationToken)
  {
    if (image is null || image.Length <= 0)
      throw new InvalidOperationException("Image file is required.");

    if (image.Length > 5 * 1024 * 1024)
      throw new InvalidOperationException("Avatar file is too large. Maximum 5 MB.");

    var adminId = User.GetRequiredUserId();
    var admin = await _db.Users.FindAsync([adminId], cancellationToken)
      ?? throw new InvalidOperationException("Admin user was not found.");

    if (admin.Role != Role.Admin)
      throw new InvalidOperationException("Only pharmacy admins can upload this avatar.");

    if (!string.IsNullOrEmpty(admin.AvatarUrl))
    {
      try { await _imageStorage.DeleteAsync(admin.AvatarUrl, cancellationToken); }
      catch { /* best-effort cleanup */ }
    }

    var contentType = string.IsNullOrWhiteSpace(image.ContentType) ? "application/octet-stream" : image.ContentType;
    using var stream = image.OpenReadStream();
    var key = await _imageStorage.UploadAsync(
      stream,
      contentType,
      $"admin-avatar-{adminId}{Path.GetExtension(image.FileName)}",
      cancellationToken);

    admin.SetAvatarUrl(key);
    await _db.SaveChangesAsync(cancellationToken);

    return Ok(new { avatarUrl = "/api/admins/me/avatar/content" });
  }

  [HttpGet("me/avatar/content")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetMyAvatarContent(CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var admin = await _db.Users.FindAsync([adminId], cancellationToken)
      ?? throw new InvalidOperationException("Admin user was not found.");

    if (string.IsNullOrEmpty(admin.AvatarUrl))
      return NotFound();

    var content = await _imageStorage.GetContentAsync(admin.AvatarUrl, cancellationToken);
    return File(content.Content, content.ContentType);
  }

  [HttpPut("{adminId:guid}")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> UpdateAnyAdminProfile(
    Guid adminId,
    [FromBody] UpdateAdminProfileRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.UpdateAdminProfileAsync(adminId, request, cancellationToken);
    return Ok(response);
  }
}
