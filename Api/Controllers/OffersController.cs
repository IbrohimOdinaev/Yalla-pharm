using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/offers")]
public sealed class OffersController : ControllerBase
{
  private readonly IPharmacyWorkerService _pharmacyWorkerService;

  public OffersController(IPharmacyWorkerService pharmacyWorkerService)
  {
    _pharmacyWorkerService = pharmacyWorkerService;
  }

  [HttpPost]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> Upsert(
    [FromBody] UpsertOfferRequest request,
    CancellationToken cancellationToken)
  {
    var pharmacyId = User.GetRequiredPharmacyId();
    var response = await _pharmacyWorkerService.UpsertOfferAsync(request, pharmacyId, cancellationToken);
    return Ok(response);
  }
}
