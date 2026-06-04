using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/pharmacy-finance")]
public sealed class PharmacyFinanceController : ControllerBase
{
  private static readonly HashSet<string> AllowedReceiptContentTypes = new(StringComparer.OrdinalIgnoreCase)
  {
    "image/png",
    "image/jpeg",
    "image/webp"
  };

  private readonly IPharmacyFinanceService _service;
  private readonly IManualLookupImageStorage _imageStorage;

  public PharmacyFinanceController(
    IPharmacyFinanceService service,
    IManualLookupImageStorage imageStorage)
  {
    _service = service;
    _imageStorage = imageStorage;
  }

  [HttpGet("admin")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetAdminFinance(CancellationToken cancellationToken)
  {
    var response = await _service.GetForAdminAsync(
      User.GetRequiredUserId(),
      User.GetRequiredPharmacyId(),
      cancellationToken);
    return Ok(response);
  }

  [HttpPost("admin/withdrawals")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> CreateWithdrawal(
    [FromBody] CreatePharmacyWithdrawalRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _service.CreateWithdrawalRequestAsync(
      User.GetRequiredUserId(),
      User.GetRequiredPharmacyId(),
      request,
      cancellationToken);
    return Ok(response);
  }

  [HttpGet("superadmin/withdrawals")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetSuperAdminWithdrawals(CancellationToken cancellationToken)
  {
    var response = await _service.GetForSuperAdminAsync(cancellationToken);
    return Ok(response);
  }

  [HttpPost("superadmin/withdrawals/{withdrawalRequestId:guid}/complete")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> CompleteWithdrawal(
    Guid withdrawalRequestId,
    [FromForm] CompletePharmacyWithdrawalForm request,
    CancellationToken cancellationToken)
  {
    if (request.Receipt is null || request.Receipt.Length <= 0)
      throw new InvalidOperationException("Для подтверждения выплаты нужно прикрепить скрин чека.");

    var receiptImageKey = await UploadReceiptAsync(withdrawalRequestId, request.Receipt, cancellationToken);
    try
    {
      var response = await _service.CompleteWithdrawalRequestAsync(
        User.GetRequiredUserId(),
        withdrawalRequestId,
        receiptImageKey,
        request.Comment,
        cancellationToken);
      return Ok(response);
    }
    catch
    {
      try { await _imageStorage.DeleteAsync(receiptImageKey, cancellationToken); }
      catch { /* best-effort cleanup */ }
      throw;
    }
  }

  [HttpGet("withdrawals/{withdrawalRequestId:guid}/receipt/content")]
  [Authorize(Roles = $"{nameof(Role.SuperAdmin)},{nameof(Role.Admin)}")]
  public async Task<IActionResult> GetReceiptContent(
    Guid withdrawalRequestId,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var content = await _service.GetReceiptContentAsync(
      withdrawalRequestId,
      User.GetRequiredUserId(),
      role,
      role == Role.Admin ? User.GetRequiredPharmacyId() : null,
      cancellationToken);
    return File(content.Content, content.ContentType);
  }

  private async Task<string> UploadReceiptAsync(
    Guid withdrawalRequestId,
    IFormFile receipt,
    CancellationToken cancellationToken)
  {
    if (receipt.Length > 5 * 1024 * 1024)
      throw new InvalidOperationException("Фото чека слишком большое. Максимум 5 MB.");

    var contentType = string.IsNullOrWhiteSpace(receipt.ContentType)
      ? "application/octet-stream"
      : receipt.ContentType;

    if (!AllowedReceiptContentTypes.Contains(contentType))
      throw new InvalidOperationException("Фото чека должно быть png, jpg/jpeg или webp.");

    await using var stream = receipt.OpenReadStream();
    return await _imageStorage.UploadAsync(
      stream,
      contentType,
      $"pharmacy-withdrawal-{withdrawalRequestId}-{Guid.NewGuid():N}{Path.GetExtension(receipt.FileName)}",
      cancellationToken);
  }

  public sealed class CompletePharmacyWithdrawalForm
  {
    public string? Comment { get; init; }
    public IFormFile? Receipt { get; init; }
  }
}
