using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/pharmacies")]
public sealed class PharmaciesController : ControllerBase
{
  private readonly IPharmacyWorkerService _pharmacyWorkerService;

  public PharmaciesController(IPharmacyWorkerService pharmacyWorkerService)
  {
    _pharmacyWorkerService = pharmacyWorkerService;
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
        Longitude = request.Longitude
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
}
