using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Api.Extensions;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/medicines")]
public sealed class MedicinesController : ControllerBase
{
  private readonly IMedicineService _medicineService;
  private readonly IMedicineSearchEngine _searchEngine;

  public MedicinesController(IMedicineService medicineService, IMedicineSearchEngine searchEngine)
  {
    _medicineService = medicineService;
    _searchEngine = searchEngine;
  }

  [HttpGet]
  [AllowAnonymous]
  public async Task<IActionResult> GetCatalog(
    [FromQuery] GetMedicinesCatalogRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.GetMedicinesCatalogAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("all")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetAll(
    [FromQuery] GetAllMedicinesRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.GetAllMedicinesAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("{medicineId:guid}")]
  [AllowAnonymous]
  public async Task<IActionResult> GetById(
    Guid medicineId,
    CancellationToken cancellationToken)
  {
    var role = Role.Client;
    if (User.Identity?.IsAuthenticated == true)
    {
      role = User.GetRequiredRole();
    }

    var response = await _medicineService.GetMedicineByIdAsync(new GetMedicineByIdRequest
    {
      MedicineId = medicineId,
      IncludeInactive = role == Role.Admin || role == Role.SuperAdmin
    }, cancellationToken);

    return Ok(response);
  }

  [HttpPost]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Create(
    [FromBody] CreateMedicineRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.CreateMedicineAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPut]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Update(
    [FromBody] UpdateMedicineRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.UpdateMedicineAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpDelete]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Delete(
    [FromBody] DeleteMedicineRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.DeleteMedicineAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("search")]
  [AllowAnonymous]
  public async Task<IActionResult> Search(
    [FromBody] SearchMedicinesRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.SearchMedicinesAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("search-by-pharmacy")]
  [AllowAnonymous]
  public async Task<IActionResult> SearchByPharmacy(
    [FromBody] SearchByPharmacyRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.SearchByPharmacyAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("live-search")]
  [AllowAnonymous]
  public async Task<IActionResult> LiveSearch(
    [FromQuery] string q = "",
    [FromQuery] int limit = 10,
    CancellationToken cancellationToken = default)
  {
    if (string.IsNullOrWhiteSpace(q))
      return Ok(new { suggestions = Array.Empty<object>() });

    var results = await _searchEngine.SearchAsync(q.Trim(), Math.Min(limit, 20), cancellationToken);
    return Ok(new
    {
      suggestions = results.Select(r => new
      {
        r.Id,
        r.Title,
        r.Articul,
        r.CategoryName,
        r.MinPrice,
        r.Score
      })
    });
  }

  [HttpPost("reindex")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> Reindex(CancellationToken cancellationToken)
  {
    await _searchEngine.ReindexAllAsync(cancellationToken);
    return Ok(new { message = "Reindex completed" });
  }

  [HttpPost("images")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> CreateImage(
    [FromForm] CreateMedicineImageRequest request,
    [FromForm] IFormFile image,
    CancellationToken cancellationToken)
  {
    if (image is null)
      throw new InvalidOperationException("Image file is required.");

    if (image.Length <= 0)
      throw new InvalidOperationException("Image file is empty.");

    if (image.Length > UserInputPolicy.MaxMedicineImageFileSizeBytes)
    {
      throw new InvalidOperationException(
        $"Image file is too large. Maximum allowed size is {UserInputPolicy.MaxMedicineImageFileSizeBytes / (1024 * 1024)} MB.");
    }

    var contentType = string.IsNullOrWhiteSpace(image.ContentType)
      ? "application/octet-stream"
      : image.ContentType;

    using var imageStream = image.OpenReadStream();
    var response = await _medicineService.CreateMedicineImageAsync(
      request,
      imageStream,
      image.FileName,
      contentType,
      cancellationToken);

    return Ok(response);
  }

  [HttpGet("images/{medicineImageId:guid}/content")]
  [AllowAnonymous]
  public async Task<IActionResult> GetImageContent(
    Guid medicineImageId,
    CancellationToken cancellationToken)
  {
    var image = await _medicineService.GetMedicineImageContentAsync(medicineImageId, cancellationToken);
    return File(image.Content, image.ContentType);
  }

  [HttpDelete("images")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> DeleteImage(
    [FromBody] DeleteMedicineImageRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _medicineService.DeleteMedicineImageAsync(request, cancellationToken);
    return Ok(response);
  }
}
