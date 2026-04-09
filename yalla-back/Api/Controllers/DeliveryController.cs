using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Api.Controllers;

[ApiController]
[Route("api/delivery")]
public sealed class DeliveryController : ControllerBase
{
  private readonly IJuraService _jura;
  private readonly IAppDbContext _dbContext;

  public DeliveryController(IJuraService jura, IAppDbContext dbContext)
  {
    _jura = jura;
    _dbContext = dbContext;
  }

  [HttpPost("calculate")]
  [AllowAnonymous]
  public async Task<IActionResult> Calculate([FromBody] CalculateDeliveryRequest request, CancellationToken ct)
  {
    var pharmacy = await _dbContext.Pharmacies
      .AsNoTracking()
      .FirstOrDefaultAsync(p => p.Id == request.PharmacyId, ct);

    if (pharmacy == null)
      return NotFound(new { message = "Pharmacy not found." });

    if (!pharmacy.Latitude.HasValue || !pharmacy.Longitude.HasValue)
      return BadRequest(new { message = "Pharmacy does not have coordinates configured." });

    var from = new JuraAddress
    {
      Title = pharmacy.Title,
      Address = pharmacy.Address,
      Lat = pharmacy.Latitude.Value,
      Lng = pharmacy.Longitude.Value
    };

    var to = new JuraAddress
    {
      Id = request.ToAddressId,
      Title = request.ToTitle,
      Address = request.ToAddress,
      Lat = request.ToLatitude,
      Lng = request.ToLongitude
    };

    var result = await _jura.CalculateDeliveryAsync(from, to, tariffId: null, clientPhone: null, ct);

    return Ok(new CalculateDeliveryResponse
    {
      DeliveryCost = result.Amount,
      Distance = result.Distance
    });
  }

  [HttpGet("{orderId:guid}/driver-position")]
  [Authorize]
  public async Task<IActionResult> GetDriverPosition(Guid orderId, CancellationToken ct)
  {
    var delivery = await _dbContext.DeliveryData
      .AsNoTracking()
      .FirstOrDefaultAsync(d => d.OrderId == orderId, ct);

    if (delivery == null)
      return NotFound(new { message = "Delivery data not found." });

    if (!delivery.DriverDeviceId.HasValue)
      return NotFound(new { message = "Driver not assigned yet." });

    var position = await _jura.GetDriverPositionAsync(delivery.DriverDeviceId.Value, ct);

    return Ok(new DriverPositionResponse
    {
      Lat = position.Lat,
      Lng = position.Lng
    });
  }

  [HttpGet("{orderId:guid}/status")]
  [Authorize]
  public async Task<IActionResult> GetDeliveryStatus(Guid orderId, CancellationToken ct)
  {
    var delivery = await _dbContext.DeliveryData
      .AsNoTracking()
      .FirstOrDefaultAsync(d => d.OrderId == orderId, ct);

    if (delivery == null)
      return NotFound(new { message = "Delivery data not found." });

    if (!delivery.JuraOrderId.HasValue)
      return Ok(new
      {
        juraStatus = delivery.JuraStatus,
        driverName = delivery.DriverName,
        driverPhone = delivery.DriverPhone,
        deliveryCost = delivery.DeliveryCost
      });

    var status = await _jura.GetOrderStatusAsync(delivery.JuraOrderId.Value, ct);

    return Ok(new
    {
      juraStatus = status.Status,
      juraStatusId = status.StatusId,
      driverName = $"{status.FirstName} {status.LastName}".Trim(),
      driverPhone = status.Phone,
      deliveryCost = delivery.DeliveryCost
    });
  }
}
