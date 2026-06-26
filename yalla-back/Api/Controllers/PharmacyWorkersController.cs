using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/pharmacy-workers")]
[Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.PharmacyAccount)},{nameof(Role.SuperAdmin)}")]
public sealed class PharmacyWorkersController : ControllerBase
{
  private readonly IPharmacyWorkerService _pharmacyWorkerService;

  public PharmacyWorkersController(IPharmacyWorkerService pharmacyWorkerService)
  {
    _pharmacyWorkerService = pharmacyWorkerService;
  }

  [HttpPost]
  [Authorize(Roles = $"{nameof(Role.PharmacyAccount)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> Register(
    [FromBody] RegisterPharmacyWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var scopedRequest = request;

    if (role == Role.PharmacyAccount)
    {
      scopedRequest = new RegisterPharmacyWorkerRequest
      {
        Name = request.Name,
        PhoneNumber = request.PhoneNumber,
        Password = request.Password,
        PharmacyId = User.GetRequiredPharmacyId()
      };
    }

    var response = await _pharmacyWorkerService.RegisterPharmacyWorkerAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpDelete]
  [Authorize(Roles = $"{nameof(Role.PharmacyAccount)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> Delete(
    [FromBody] DeletePharmacyWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var response = role == Role.PharmacyAccount
      ? await _pharmacyWorkerService.DeletePharmacyWorkerInPharmacyAsync(
        request,
        User.GetRequiredPharmacyId(),
        cancellationToken)
      : await _pharmacyWorkerService.DeletePharmacyWorkerAsync(request, cancellationToken);

    return Ok(response);
  }

  [HttpGet("mine/admins")]
  [Authorize(Roles = nameof(Role.PharmacyAccount))]
  public async Task<IActionResult> GetMyAdmins(CancellationToken cancellationToken)
  {
    var response = await _pharmacyWorkerService.GetActiveAdminsForPharmacyAsync(
      User.GetRequiredPharmacyId(),
      cancellationToken);
    return Ok(new { admins = response });
  }
}
