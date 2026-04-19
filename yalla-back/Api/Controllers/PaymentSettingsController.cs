using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/payment-settings")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class PaymentSettingsController : ControllerBase
{
  private readonly IPaymentSettingsService _service;

  public PaymentSettingsController(IPaymentSettingsService service)
  {
    _service = service;
  }

  [HttpGet]
  public async Task<IActionResult> Get(CancellationToken cancellationToken)
  {
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(snapshot);
  }

  [HttpPut("dc-base-url")]
  public async Task<IActionResult> UpdateDcBaseUrl(
    [FromBody] UpdateDcBaseUrlRequest request,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    await _service.SetDcBaseUrlAsync(request.Url, userId, cancellationToken);
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(snapshot);
  }

  public sealed class UpdateDcBaseUrlRequest
  {
    public string? Url { get; init; }
  }
}
