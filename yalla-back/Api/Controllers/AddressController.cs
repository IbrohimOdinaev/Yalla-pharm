using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Abstractions;

namespace Api.Controllers;

[ApiController]
[Route("api/address")]
public sealed class AddressController : ControllerBase
{
  private readonly IJuraService _jura;

  public AddressController(IJuraService jura)
  {
    _jura = jura;
  }

  [HttpGet("search")]
  [AllowAnonymous]
  public async Task<IActionResult> Search([FromQuery] string text, CancellationToken ct)
  {
    if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < 2)
      return Ok(Array.Empty<object>());

    var results = await _jura.SearchAddressAsync(text.Trim(), ct);
    return Ok(results);
  }
}
