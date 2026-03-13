using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/pharmacy-workers")]
[Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.SuperAdmin)}")]
public sealed class PharmacyWorkersController : ControllerBase
{
  private readonly IPharmacyWorkerService _pharmacyWorkerService;

  public PharmacyWorkersController(IPharmacyWorkerService pharmacyWorkerService)
  {
    _pharmacyWorkerService = pharmacyWorkerService;
  }

  [HttpPost]
  public async Task<IActionResult> Register(
    [FromBody] RegisterPharmacyWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var scopedRequest = request;

    if (role == Role.Admin)
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
  public async Task<IActionResult> Delete(
    [FromBody] DeletePharmacyWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var response = role == Role.Admin
      ? await _pharmacyWorkerService.DeletePharmacyWorkerInPharmacyAsync(
        request,
        User.GetRequiredPharmacyId(),
        cancellationToken)
      : await _pharmacyWorkerService.DeletePharmacyWorkerAsync(request, cancellationToken);

    return Ok(response);
  }
}
