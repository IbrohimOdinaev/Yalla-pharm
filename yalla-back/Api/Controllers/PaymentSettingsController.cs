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

  [HttpGet("public")]
  [AllowAnonymous]
  public async Task<IActionResult> GetPublic(CancellationToken cancellationToken)
  {
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(new
    {
      dcBaseUrlEffective = snapshot.DcBaseUrlEffective,
      alifUrlTemplateEffective = snapshot.AlifUrlTemplateEffective,
      eskhataUrlTemplateEffective = snapshot.EskhataUrlTemplateEffective,
      isDcEnabled = snapshot.IsDcEnabled,
      isAlifEnabled = snapshot.IsAlifEnabled,
      isEskhataEnabled = snapshot.IsEskhataEnabled
    });
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

  [HttpPut("alif-url-template")]
  public async Task<IActionResult> UpdateAlifUrlTemplate(
    [FromBody] UpdatePaymentUrlTemplateRequest request,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    await _service.SetAlifUrlTemplateAsync(request.UrlTemplate, userId, cancellationToken);
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(snapshot);
  }

  [HttpPut("eskhata-url-template")]
  public async Task<IActionResult> UpdateEskhataUrlTemplate(
    [FromBody] UpdatePaymentUrlTemplateRequest request,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    await _service.SetEskhataUrlTemplateAsync(request.UrlTemplate, userId, cancellationToken);
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(snapshot);
  }

  public sealed class UpdatePaymentUrlTemplateRequest
  {
    public string? UrlTemplate { get; init; }
  }

  [HttpPut("method/{method}/enabled")]
  public async Task<IActionResult> UpdatePaymentMethodEnabled(
    string method,
    [FromBody] UpdatePaymentMethodEnabledRequest request,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    await _service.SetPaymentMethodEnabledAsync(method, request.IsEnabled, userId, cancellationToken);
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(snapshot);
  }

  public sealed class UpdatePaymentMethodEnabledRequest
  {
    public bool IsEnabled { get; init; }
  }

  [HttpPut("staff-compensation-rates")]
  public async Task<IActionResult> UpdateStaffCompensationRates(
    [FromBody] UpdateStaffCompensationRatesRequest request,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    await _service.SetStaffCompensationRatesAsync(
      request.PharmacyOrderReadyFeeAmount,
      request.PrescriptionDecodedFeeAmount,
      userId,
      cancellationToken);
    var snapshot = await _service.GetSnapshotAsync(cancellationToken);
    return Ok(snapshot);
  }

  public sealed class UpdateStaffCompensationRatesRequest
  {
    public decimal PharmacyOrderReadyFeeAmount { get; init; }
    public decimal PrescriptionDecodedFeeAmount { get; init; }
  }
}
