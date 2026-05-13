using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/pharmacists")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class PharmacistsController : ControllerBase
{
    private readonly IPharmacistService _pharmacistService;

    public PharmacistsController(IPharmacistService pharmacistService)
    {
        _pharmacistService = pharmacistService;
    }

    /// <summary>SuperAdmin only — create a new Pharmacist user (global pool worker).</summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register(
      [FromBody] RegisterPharmacistRequest request,
      CancellationToken cancellationToken)
    {
        var response = await _pharmacistService.RegisterAsync(request, cancellationToken);
        return Ok(response);
    }

    /// <summary>List of every pharmacist (SuperAdmin pool view).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var response = await _pharmacistService.GetAllAsync(cancellationToken);
        return Ok(response);
    }

    [HttpDelete("{pharmacistId:guid}")]
    public async Task<IActionResult> Delete(Guid pharmacistId, CancellationToken cancellationToken)
    {
        await _pharmacistService.DeleteAsync(pharmacistId, cancellationToken);
        return Ok();
    }

    /// <summary>Mark a pharmacist inactive. Login is rejected; tokens
    /// stop working within ~60s. In-flight InReview prescriptions are
    /// NOT auto-reassigned — the response carries a warning + count
    /// so the SuperAdmin can re-route them manually.</summary>
    [HttpPost("{pharmacistId:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(
      Guid pharmacistId,
      [FromBody] DeactivateUserRequest request,
      [FromServices] IUserActivationChecker activationChecker,
      CancellationToken cancellationToken)
    {
        var superAdminId = User.GetRequiredUserId();
        var response = await _pharmacistService.DeactivateAsync(
          pharmacistId, superAdminId, request, cancellationToken);
        activationChecker.Invalidate(pharmacistId);
        return Ok(response);
    }

    [HttpPost("{pharmacistId:guid}/activate")]
    public async Task<IActionResult> Activate(
      Guid pharmacistId,
      [FromServices] IUserActivationChecker activationChecker,
      CancellationToken cancellationToken)
    {
        var superAdminId = User.GetRequiredUserId();
        var response = await _pharmacistService.ActivateAsync(
          pharmacistId, superAdminId, cancellationToken);
        activationChecker.Invalidate(pharmacistId);
        return Ok(response);
    }
}
