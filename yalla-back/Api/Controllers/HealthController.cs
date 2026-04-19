using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Abstractions;

namespace Api.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
  private readonly IJuraHealthState _juraHealth;

  public HealthController(IJuraHealthState juraHealth)
  {
    _juraHealth = juraHealth;
  }

  [HttpGet("jura")]
  [AllowAnonymous]
  public IActionResult GetJuraHealth()
  {
    var snapshot = _juraHealth.GetSnapshot();
    return StatusCode(snapshot.Healthy ? 200 : 503, snapshot);
  }
}
