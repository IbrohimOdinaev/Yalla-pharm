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
}
