using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Abstractions;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/staff-compensation")]
public sealed class StaffCompensationController : ControllerBase
{
  private static readonly HashSet<string> AllowedReceiptContentTypes = new(StringComparer.OrdinalIgnoreCase)
  {
    "image/png",
    "image/jpeg",
    "image/webp"
  };

  private readonly IStaffCompensationService _service;
  private readonly IManualLookupImageStorage _imageStorage;

  public StaffCompensationController(
    IStaffCompensationService service,
    IManualLookupImageStorage imageStorage)
  {
    _service = service;
    _imageStorage = imageStorage;
  }

  [HttpGet("me")]
  [Authorize(Roles = $"{nameof(Role.Admin)},{nameof(Role.Pharmacist)}")]
  public async Task<IActionResult> GetMe(CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    var response = await _service.GetMeAsync(userId, cancellationToken);
    return Ok(response);
  }

  [HttpPost("payouts")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> CreatePayout(
    [FromForm] CreateStaffPayoutForm request,
    CancellationToken cancellationToken)
  {
    var superAdminId = User.GetRequiredUserId();
    var method = ParseMethod(request.Method);
    string? receiptImageKey = null;

    if (method == StaffPayoutMethod.Transfer)
    {
      if (request.Receipt is null || request.Receipt.Length <= 0)
        throw new InvalidOperationException("Для перевода нужно прикрепить фото чека.");

      receiptImageKey = await UploadReceiptAsync(request.StaffUserId, request.Receipt, cancellationToken);
    }
    else if (request.Receipt is { Length: > 0 })
    {
      receiptImageKey = await UploadReceiptAsync(request.StaffUserId, request.Receipt, cancellationToken);
    }

    try
    {
      var response = await _service.CreatePayoutAsync(
        superAdminId,
        request.StaffUserId,
        request.Amount,
        method,
        receiptImageKey,
        request.Note,
        cancellationToken);
      return Ok(response);
    }
    catch
    {
      if (!string.IsNullOrWhiteSpace(receiptImageKey))
      {
        try { await _imageStorage.DeleteAsync(receiptImageKey, cancellationToken); }
        catch { /* best-effort cleanup */ }
      }

      throw;
    }
  }

  [HttpGet("payouts/{payoutId:guid}/receipt/content")]
  [Authorize(Roles = $"{nameof(Role.SuperAdmin)},{nameof(Role.Admin)},{nameof(Role.Pharmacist)}")]
  public async Task<IActionResult> GetPayoutReceiptContent(
    Guid payoutId,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    var role = User.GetRequiredRole();
    var content = await _service.GetPayoutReceiptContentAsync(payoutId, userId, role, cancellationToken);
    return File(content.Content, content.ContentType);
  }

  private async Task<string> UploadReceiptAsync(
    Guid staffUserId,
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
      $"staff-payout-{staffUserId}-{Guid.NewGuid():N}{Path.GetExtension(receipt.FileName)}",
      cancellationToken);
  }

  private static StaffPayoutMethod ParseMethod(string? method)
  {
    if (Enum.TryParse<StaffPayoutMethod>(method, ignoreCase: true, out var parsed))
      return parsed;

    var normalized = (method ?? string.Empty).Trim().ToLowerInvariant();
    return normalized switch
    {
      "cash" or "наличка" or "наличные" => StaffPayoutMethod.Cash,
      "transfer" or "перевод" => StaffPayoutMethod.Transfer,
      _ => throw new InvalidOperationException("Неизвестный способ выплаты.")
    };
  }

  public sealed class CreateStaffPayoutForm
  {
    public Guid StaffUserId { get; init; }
    public decimal Amount { get; init; }
    public string? Method { get; init; }
    public string? Note { get; init; }
    public IFormFile? Receipt { get; init; }
  }
}
