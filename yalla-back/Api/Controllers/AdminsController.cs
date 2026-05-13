using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

  public AdminsController(
    IAuthService authService,
    IPharmacyWorkerService pharmacyWorkerService)
  {
    _authService = authService;
    _pharmacyWorkerService = pharmacyWorkerService;
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
