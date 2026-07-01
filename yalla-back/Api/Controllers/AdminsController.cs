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
  private readonly IStaffTelegramNotificationService _staffTelegramNotificationService;
  private readonly IAppDbContext _db;
  private readonly IMedicineImageStorage _imageStorage;

  public AdminsController(
    IAuthService authService,
    IPharmacyWorkerService pharmacyWorkerService,
    IStaffTelegramNotificationService staffTelegramNotificationService,
    IAppDbContext db,
    IMedicineImageStorage imageStorage)
  {
    _authService = authService;
    _pharmacyWorkerService = pharmacyWorkerService;
    _staffTelegramNotificationService = staffTelegramNotificationService;
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
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> UpdateMyProfile(
    [FromBody] UpdateAdminProfileRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _authService.UpdateAdminProfileAsync(adminId, request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("me")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> GetMyProfile(CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var admin = await _db.Users
      .AsNoTracking()
      .Where(x => x.Id == adminId && (x.Role == Role.Admin || x.Role == Role.PharmacyAccount))
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

  [HttpGet("me/telegram/recipients")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> GetMyTelegramRecipients(CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _staffTelegramNotificationService.GetRecipientsAsync(adminId, cancellationToken);
    return Ok(response);
  }

  [HttpPost("me/telegram/link/start")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> StartMyTelegramLink(CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _staffTelegramNotificationService.StartLinkAsync(adminId, cancellationToken);
    return Ok(response);
  }

  [HttpGet("me/telegram/link/poll")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> PollMyTelegramLink(
    [FromQuery] string nonce,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _staffTelegramNotificationService.PollAsync(adminId, nonce, cancellationToken);
    return Ok(response);
  }

  [HttpPost("me/telegram/link/complete")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> CompleteMyTelegramLink(
    [FromBody] CompleteTelegramAuthRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _staffTelegramNotificationService.CompleteLinkAsync(
      adminId,
      request.Nonce,
      cancellationToken);
    return Ok(response);
  }

  [HttpDelete("me/telegram/recipients/{recipientId:guid}")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> DeleteMyTelegramRecipient(
    Guid recipientId,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    await _staffTelegramNotificationService.DeleteRecipientAsync(adminId, recipientId, cancellationToken);
    return NoContent();
  }

  [HttpPost("me/otp/request")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> RequestMyProfileOtp(
    [FromBody] RequestAdminProfileUpdateOtpRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _authService.RequestAdminProfileUpdateOtpAsync(adminId, request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("me/otp/verify")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
  public async Task<IActionResult> VerifyMyProfileOtp(
    [FromBody] VerifyAdminProfileUpdateOtpRequest request,
    CancellationToken cancellationToken)
  {
    var adminId = User.GetRequiredUserId();
    var response = await _authService.VerifyAdminProfileUpdateOtpAsync(adminId, request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("me/avatar")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
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

    if (admin.Role is not (Role.Admin or Role.PharmacyAccount))
      throw new InvalidOperationException("Only pharmacy staff can upload this avatar.");

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

  [HttpPost("{adminId:guid}/avatar")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> UploadAdminAvatar(
    Guid adminId,
    [FromForm] IFormFile image,
    CancellationToken cancellationToken)
  {
    if (image is null || image.Length <= 0)
      throw new InvalidOperationException("Image file is required.");

    if (image.Length > 5 * 1024 * 1024)
      throw new InvalidOperationException("Avatar file is too large. Maximum 5 MB.");

    var admin = await _db.Users.FindAsync([adminId], cancellationToken)
      ?? throw new InvalidOperationException("Admin user was not found.");

    if (admin.Role is not (Role.Admin or Role.PharmacyAccount))
      throw new InvalidOperationException("Only pharmacy staff can have this avatar.");

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

    return Ok(new { avatarUrl = $"/api/admins/{adminId}/avatar/content" });
  }

  [HttpGet("me/avatar/content")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)}")]
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

  [HttpGet("{adminId:guid}/avatar/content")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> GetAdminAvatarContent(
    Guid adminId,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    if ((role is Role.Admin or Role.PharmacyAccount) && User.GetRequiredUserId() != adminId)
      return Forbid();

    var admin = await _db.Users.FindAsync([adminId], cancellationToken)
      ?? throw new InvalidOperationException("Admin user was not found.");

    if (admin.Role is not (Role.Admin or Role.PharmacyAccount))
      throw new InvalidOperationException("Only pharmacy staff can have this avatar.");

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
