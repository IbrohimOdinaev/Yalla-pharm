using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
  private readonly IOrderService _orderService;

  public OrdersController(IOrderService orderService)
  {
    _orderService = orderService;
  }

  [HttpGet("client-history")]
  [Authorize(Roles = $"{nameof(Role.Client)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> GetClientHistory(
    [FromQuery] GetClientOrderHistoryRequest request,
    CancellationToken cancellationToken)
  {
    var role = User.GetRequiredRole();
    var scopedRequest = request;
    if (role == Role.Client)
    {
      scopedRequest = new GetClientOrderHistoryRequest
      {
        ClientId = User.GetRequiredUserId()
      };
    }

    var response = await _orderService.GetClientOrderHistoryAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpGet("all")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> GetAll(
    [FromQuery] GetAllOrdersRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _orderService.GetAllOrdersAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("{orderId:guid}")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> GetClientOrderDetails(
    Guid orderId,
    CancellationToken cancellationToken)
  {
    var response = await _orderService.GetClientOrderDetailsAsync(new GetClientOrderDetailsRequest
    {
      ClientId = User.GetRequiredUserId(),
      OrderId = orderId
    }, cancellationToken);

    return Ok(response);
  }

  [HttpGet("worker/new")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetNewForWorker(
    [FromQuery] GetNewOrdersForWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var response = await GetScopedPharmacyOrdersAsync(request.Take, cancellationToken);
    return Ok(response);
  }

  [HttpGet("admin/pharmacy")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetOrdersForAdminPharmacy(
    [FromQuery] GetNewOrdersForWorkerRequest request,
    CancellationToken cancellationToken)
  {
    var response = await GetScopedPharmacyOrdersAsync(request.Take, cancellationToken);
    return Ok(response);
  }

  [HttpGet("admin/history")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetHistoryForAdminPharmacy(
    [FromQuery] GetPharmacyOrdersRequest request,
    CancellationToken cancellationToken)
  {
    var response = await GetScopedPharmacyHistoryAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("worker/history")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> GetHistoryForWorkerPharmacy(
    [FromQuery] GetPharmacyOrdersRequest request,
    CancellationToken cancellationToken)
  {
    var response = await GetScopedPharmacyHistoryAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("admin/new/delete")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> DeleteNewAsAdmin(
    [FromBody] DeleteNewOrderByAdminRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new DeleteNewOrderByAdminRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.DeleteNewOrderByAdminAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("superadmin/next-status")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> MoveToNextStatusBySuperAdmin(
    [FromBody] MarkOrderDeliveredBySuperAdminRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new MarkOrderDeliveredBySuperAdminRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.MoveOrderToNextStatusBySuperAdminAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("assembly/start")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> StartAssembly(
    [FromBody] StartOrderAssemblyRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new StartOrderAssemblyRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.StartOrderAssemblyAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("positions/reject")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> RejectPositions(
    [FromBody] RejectOrderPositionsRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new RejectOrderPositionsRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      OrderId = request.OrderId,
      PositionIds = request.PositionIds
    };

    var response = await _orderService.RejectOrderPositionsAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("ready")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> MarkReady(
    [FromBody] MarkOrderReadyRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new MarkOrderReadyRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.MarkOrderReadyAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("on-the-way")]
  [Authorize(Roles = nameof(Role.Admin))]
  public async Task<IActionResult> MarkOnTheWay(
    [FromBody] MarkOrderOnTheWayRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new MarkOrderOnTheWayRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.MarkOrderOnTheWayAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("delivered")]
  [Authorize(Roles = nameof(Role.SuperAdmin))]
  public async Task<IActionResult> MarkDelivered(
    [FromBody] MarkOrderDeliveredBySuperAdminRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new MarkOrderDeliveredBySuperAdminRequest
    {
      SuperAdminId = User.GetRequiredUserId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.MarkOrderDeliveredBySuperAdminAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  [HttpPost("cancel")]
  [Authorize(Roles = nameof(Role.Client))]
  public async Task<IActionResult> Cancel(
    [FromBody] CancelOrderRequest request,
    CancellationToken cancellationToken)
  {
    var scopedRequest = new CancelOrderRequest
    {
      ClientId = User.GetRequiredUserId(),
      OrderId = request.OrderId
    };

    var response = await _orderService.CancelOrderAsync(scopedRequest, cancellationToken);
    return Ok(response);
  }

  private async Task<Yalla.Application.DTO.Response.GetNewOrdersForWorkerResponse> GetScopedPharmacyOrdersAsync(
    int take,
    CancellationToken cancellationToken)
  {
    return await _orderService.GetNewOrdersForWorkerAsync(new GetNewOrdersForWorkerRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      Take = take
    }, cancellationToken);
  }

  private async Task<Yalla.Application.DTO.Response.GetPharmacyOrdersResponse> GetScopedPharmacyHistoryAsync(
    GetPharmacyOrdersRequest request,
    CancellationToken cancellationToken)
  {
    return await _orderService.GetPharmacyOrdersAsync(new GetPharmacyOrdersRequest
    {
      WorkerId = User.GetRequiredUserId(),
      PharmacyId = User.GetRequiredPharmacyId(),
      Status = request.Status,
      Page = request.Page,
      PageSize = request.PageSize
    }, cancellationToken);
  }
}
