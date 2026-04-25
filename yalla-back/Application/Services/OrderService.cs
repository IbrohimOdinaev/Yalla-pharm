using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class OrderService : IOrderService
{
  private readonly IAppDbContext _dbContext;
  private readonly ILogger<OrderService> _logger;
  private readonly IRealtimeUpdatesPublisher _realtimeUpdatesPublisher;
  private readonly IJuraService? _juraService;

  public OrderService(IAppDbContext dbContext)
    : this(dbContext, NullLogger<OrderService>.Instance, new NoOpRealtimeUpdatesPublisher(), null)
  {
  }

  public OrderService(
    IAppDbContext dbContext,
    ILogger<OrderService> logger,
    IRealtimeUpdatesPublisher realtimeUpdatesPublisher,
    IJuraService? juraService = null)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(logger);
    ArgumentNullException.ThrowIfNull(realtimeUpdatesPublisher);

    _dbContext = dbContext;
    _logger = logger;
    _realtimeUpdatesPublisher = realtimeUpdatesPublisher;
    _juraService = juraService;
  }

  public async Task<GetAllOrdersResponse> GetAllOrdersAsync(
    GetAllOrdersRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var page = request.Page < 1 ? 1 : request.Page;
    var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

    var query = _dbContext.Orders
      .AsNoTracking()
      .AsQueryable();

    if (request.Status.HasValue)
      query = query.Where(x => x.Status == request.Status.Value);

    var totalCount = await query.CountAsync(cancellationToken);
    var orders = await query
      .Include(x => x.Positions)
      .ThenInclude(x => x.Medicine)
      .Include(x => x.DeliveryData)
      .OrderByDescending(x => x.OrderPlacedAt)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);

    var clientsById = await LoadClientsForOrdersAsync(orders, cancellationToken);

    return new GetAllOrdersResponse
    {
      Status = request.Status,
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      Orders = orders
        .Select(o => ToWorkerOrderResponse(o, clientsById))
        .ToList()
    };
  }

  public async Task<GetClientOrderHistoryResponse> GetClientOrderHistoryAsync(
    GetClientOrderHistoryRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var clientExists = await _dbContext.Clients
      .AsNoTracking()
      .AnyAsync(x => x.Id == request.ClientId, cancellationToken);

    if (!clientExists)
      throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

    var orders = await _dbContext.Orders
      .AsNoTracking()
      .Where(x => x.ClientId == request.ClientId)
      .Include(x => x.Positions)
      .ThenInclude(x => x.Medicine)
      .Include(x => x.DeliveryData)
      .OrderByDescending(x => x.OrderPlacedAt)
      .ToListAsync(cancellationToken);

    return new GetClientOrderHistoryResponse
    {
      ClientId = request.ClientId,
      Orders = orders
        .Select(x => new OrderHistoryItemResponse
        {
          OrderId = x.Id,
          PharmacyId = x.PharmacyId,
          OrderPlacedAt = x.OrderPlacedAt,
          IsPickup = x.IsPickup,
          DeliveryAddress = x.DeliveryAddress,
          Status = x.Status,
          PaymentState = x.PaymentState,
          PaymentExpiresAtUtc = x.PaymentExpiresAtUtc,
          Cost = x.Cost,
          ReturnCost = x.ReturnCost,
          DeliveryCost = x.DeliveryData != null ? x.DeliveryData.DeliveryCost : 0m,
          TotalCost = x.Cost + (x.DeliveryData != null ? x.DeliveryData.DeliveryCost : 0m),
          Comment = x.Comment,
          Positions = x.Positions
            .Select(y => new OrderHistoryPositionResponse
            {
              PositionId = y.Id,
              MedicineTitle = y.Medicine?.Title ?? $"Medicine:{y.MedicineId}"
            })
            .ToList()
        })
        .ToList()
    };
  }

  public async Task<GetClientOrderDetailsResponse> GetClientOrderDetailsAsync(
    GetClientOrderDetailsRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var order = await _dbContext.Orders
      .AsNoTracking()
      .Where(x => x.Id == request.OrderId && x.ClientId == request.ClientId)
      .Include(x => x.Positions)
      .ThenInclude(x => x.Medicine)
      .Include(x => x.DeliveryData)
      .FirstOrDefaultAsync(cancellationToken)
      ?? throw new InvalidOperationException(
        $"Order '{request.OrderId}' for client '{request.ClientId}' was not found.");

    var delivery = order.DeliveryData;
    var detailsDeliveryCost = delivery?.DeliveryCost ?? 0m;

    return new GetClientOrderDetailsResponse
    {
      ClientId = request.ClientId,
      OrderId = order.Id,
      PharmacyId = order.PharmacyId,
      OrderPlacedAt = order.OrderPlacedAt,
      IsPickup = order.IsPickup,
      DeliveryAddress = delivery?.ToAddress ?? order.DeliveryAddress,
      Status = order.Status,
      PaymentState = order.PaymentState,
      PaymentExpiresAtUtc = order.PaymentExpiresAtUtc,
      PaymentUrl = order.PaymentUrl,
      Cost = order.Cost,
      ReturnCost = order.ReturnCost,
      Comment = order.Comment,
      DeliveryCost = detailsDeliveryCost,
      DeliveryDistance = delivery?.Distance,
      TotalCost = order.Cost + detailsDeliveryCost,
      JuraOrderId = delivery?.JuraOrderId,
      JuraStatusId = delivery?.JuraStatusId,
      RecipientCode = delivery?.RecipientCode,
      DriverName = delivery?.DriverName,
      DriverPhone = delivery?.DriverPhone,
      JuraStatus = delivery?.JuraStatus,
      FromLatitude = delivery?.FromLatitude,
      FromLongitude = delivery?.FromLongitude,
      ToLatitude = delivery?.ToLatitude,
      ToLongitude = delivery?.ToLongitude,
      Positions = order.Positions
        .Select(x => new ClientOrderDetailsPositionResponse
        {
          PositionId = x.Id,
          MedicineId = x.MedicineId,
          MedicineTitle = x.Medicine?.Title ?? $"Medicine:{x.MedicineId}",
          Quantity = x.Quantity,
          ReturnedQuantity = x.ReturnedQuantity,
          IsRejected = x.IsRejected,
          Price = x.OfferSnapshot.Price
        })
        .ToList()
    };
  }

  public async Task<GetPharmacyOrdersResponse> GetPharmacyOrdersAsync(
    GetPharmacyOrdersRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: false, cancellationToken);

    if (request.PharmacyId != Guid.Empty && request.PharmacyId != worker.PharmacyId)
      throw new InvalidOperationException(
        $"Worker '{worker.Id}' is not linked to pharmacy '{request.PharmacyId}'.");

    var page = request.Page < 1 ? 1 : request.Page;
    var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

    var query = _dbContext.Orders
      .AsNoTracking()
      .Where(x => x.PharmacyId == worker.PharmacyId);

    if (request.Status.HasValue)
      query = query.Where(x => x.Status == request.Status.Value);

    var totalCount = await query.CountAsync(cancellationToken);
    var orders = await query
      .Include(x => x.Positions)
      .ThenInclude(x => x.Medicine)
      .Include(x => x.DeliveryData)
      .OrderByDescending(x => x.OrderPlacedAt)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);

    var clientsById = await LoadClientsForOrdersAsync(orders, cancellationToken);

    return new GetPharmacyOrdersResponse
    {
      WorkerId = worker.Id,
      PharmacyId = worker.PharmacyId,
      Status = request.Status,
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      Orders = orders
        .Select(o => ToWorkerOrderResponse(o, clientsById))
        .ToList()
    };
  }

  public async Task<GetNewOrdersForWorkerResponse> GetNewOrdersForWorkerAsync(
    GetNewOrdersForWorkerRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: false, cancellationToken);
    var take = NormalizeTake(request.Take);

    var orders = await _dbContext.Orders
      .AsNoTracking()
      .Where(x =>
        x.PharmacyId == worker.PharmacyId
        && (x.Status == Status.UnderReview
            || x.Status == Status.Preparing
            || x.Status == Status.Ready))
      .Include(x => x.Positions)
      .ThenInclude(x => x.Medicine)
      .Include(x => x.DeliveryData)
      .OrderByDescending(x => x.OrderPlacedAt)
      .Take(take)
      .ToListAsync(cancellationToken);

    var clientsById = await LoadClientsForOrdersAsync(orders, cancellationToken);

    return new GetNewOrdersForWorkerResponse
    {
      WorkerId = worker.Id,
      PharmacyId = worker.PharmacyId,
      Orders = orders
        .Select(o => ToWorkerOrderResponse(o, clientsById))
        .ToList()
    };
  }

  public async Task<StartOrderAssemblyResponse> StartOrderAssemblyAsync(
    StartOrderAssemblyRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: true, cancellationToken);
      var order = await GetTrackedOrderForWorkerOrThrowAsync(request.OrderId, worker.PharmacyId, cancellationToken);

      if (order.Status != Status.UnderReview)
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in status '{Status.UnderReview}' to start assembly.");

      var oldStatus = order.Status;
      order.NextStage(true);
      LogStatusTransition(order.Id, oldStatus, order.Status, "StartOrderAssembly", worker.Id);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new StartOrderAssemblyResponse
      {
        WorkerId = worker.Id,
        OrderId = order.Id,
        Status = order.Status
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<RejectOrderPositionsResponse> RejectOrderPositionsAsync(
    RejectOrderPositionsRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (request.PositionIds.Count == 0)
      throw new InvalidOperationException("At least one position id must be provided.");

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: true, cancellationToken);
      var order = await _dbContext.Orders
        .AsTracking()
        .Where(x => x.Id == request.OrderId)
        .Include(x => x.Positions)
        .ThenInclude(x => x.Medicine)
        .Include(x => x.DeliveryData)
        .FirstOrDefaultAsync(cancellationToken)
        ?? throw new InvalidOperationException($"Order '{request.OrderId}' was not found.");

      if (order.PharmacyId != worker.PharmacyId)
        throw new InvalidOperationException(
          $"Order '{order.Id}' does not belong to worker pharmacy '{worker.PharmacyId}'.");

      if (order.Status != Status.Preparing)
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in status '{Status.Preparing}' to reject positions.");

      var positionIds = request.PositionIds
        .Distinct()
        .ToList();

      var orderPositionsById = order.Positions.ToDictionary(x => x.Id, x => x);
      var invalidPositionIds = positionIds
        .Where(x => !orderPositionsById.ContainsKey(x))
        .ToList();

      if (invalidPositionIds.Count > 0)
        throw new InvalidOperationException(
          $"Positions do not belong to order '{order.Id}': {string.Join(", ", invalidPositionIds)}.");

      var positionsToReject = positionIds
        .Select(x => orderPositionsById[x])
        .Where(x => !x.IsRejected)
        .ToList();

      foreach (var positionId in positionIds)
        orderPositionsById[positionId].Reject();

      if (positionsToReject.Count > 0)
      {
        await RestoreStockForPositionsAsync(
          order.PharmacyId,
          positionsToReject,
          cancellationToken);

        _logger.LogInformation(
          "Stock restored for rejected positions in order {OrderId}. Rejected positions: {RejectedPositionsCount}.",
          order.Id,
          positionsToReject.Count);
      }

      var oldStatus = order.Status;
      order.RecalculateTotals();
      if (order.Positions.All(x => x.IsRejected))
      {
        order.Cancel();
        LogStatusTransition(order.Id, oldStatus, order.Status, "RejectOrderPositionsAutoCancel", worker.Id);
      }

      var refundRequest = CreateRefundRequestStub(order.Id, order.ReturnCost);

      _logger.LogInformation(
        "Order {OrderId} positions rejected by worker {WorkerId}. Cost: {Cost}, ReturnCost: {ReturnCost}, Status: {Status}.",
        order.Id,
        worker.Id,
        order.Cost,
        order.ReturnCost,
        order.Status);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      if (oldStatus != order.Status)
      {
        await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
          order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);
      }

      var clientsById = await LoadClientsForOrdersAsync(new[] { order }, cancellationToken);
      return new RejectOrderPositionsResponse
      {
        WorkerId = worker.Id,
        OrderId = order.Id,
        RejectedPositionIds = positionIds,
        Order = ToWorkerOrderResponse(order, clientsById),
        RefundRequest = refundRequest
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<MarkOrderReadyResponse> MarkOrderReadyAsync(
    MarkOrderReadyRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: true, cancellationToken);
      var order = await GetTrackedOrderForWorkerOrThrowAsync(request.OrderId, worker.PharmacyId, cancellationToken);

      if (order.Status != Status.Preparing)
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in status '{Status.Preparing}' to mark as ready.");

      var oldStatus = order.Status;
      order.NextStage(true);
      LogStatusTransition(order.Id, oldStatus, order.Status, "MarkOrderReady", worker.Id);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new MarkOrderReadyResponse
      {
        WorkerId = worker.Id,
        OrderId = order.Id,
        Status = order.Status
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<DispatchDeliveryResponse> DispatchDeliveryAsync(
    DispatchDeliveryRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    if (_juraService is null)
      throw new InvalidOperationException("JURA service is not configured.");

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: false, cancellationToken);
      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.DeliveryData)
        .FirstOrDefaultAsync(x => x.Id == request.OrderId, cancellationToken)
        ?? throw new InvalidOperationException($"Order '{request.OrderId}' was not found.");

      if (order.PharmacyId != worker.PharmacyId)
        throw new InvalidOperationException(
          $"Order '{order.Id}' does not belong to worker pharmacy '{worker.PharmacyId}'.");

      if (order.IsPickup)
        throw new InvalidOperationException("Pickup orders cannot be dispatched to delivery service.");

      if (order.Status != Status.Ready)
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in status '{Status.Ready}' to dispatch delivery.");

      var deliveryData = order.DeliveryData
        ?? throw new InvalidOperationException($"Order '{order.Id}' has no delivery data.");

      if (deliveryData.JuraOrderId.HasValue)
      {
        await transaction.RollbackAsync(cancellationToken);
        return new DispatchDeliveryResponse
        {
          OrderId = order.Id,
          JuraOrderId = deliveryData.JuraOrderId.Value,
          JuraStatus = deliveryData.JuraStatus ?? string.Empty,
          JuraStatusId = deliveryData.JuraStatusId ?? 0,
          DeliveryCost = deliveryData.DeliveryCost,
          DriverName = deliveryData.DriverName,
          DriverPhone = deliveryData.DriverPhone,
          AlreadyDispatched = true
        };
      }

      var from = new JuraAddress
      {
        Title = deliveryData.FromTitle,
        Address = deliveryData.FromAddress,
        Lat = deliveryData.FromLatitude,
        Lng = deliveryData.FromLongitude,
        Id = deliveryData.FromAddressId
      };
      var to = new JuraAddress
      {
        Title = deliveryData.ToTitle,
        Address = deliveryData.ToAddress,
        Lat = deliveryData.ToLatitude,
        Lng = deliveryData.ToLongitude,
        Id = deliveryData.ToAddressId
      };

      var clientPhone = !string.IsNullOrEmpty(order.ClientPhoneNumber)
        ? $"992{order.ClientPhoneNumber}"
        : null;

      // NB: we do NOT recalculate DeliveryCost here — it was fixed at checkout and
      // is what the client was quoted (Order.PaymentAmount is locked to it). JURA
      // will bill us per the chosen tariff; if it differs from the checkout quote,
      // that's an operational cost for the pharmacy, not the client.
      var result = await _juraService.CreateDeliveryOrderAsync(
        from, to, request.TariffId, clientPhone, cancellationToken);

      // ─── Orphan-protection ───
      // JURA has now created the delivery order. If we fail to persist locally,
      // we must cancel on their side to avoid a phantom dispatch (courier shows
      // up, but we have no record of it).
      try
      {
        deliveryData.SetJuraOrder(result.OrderId, result.Status, result.StatusId);
        if (result.PerformerDeviceId.HasValue)
        {
          var driverName = $"{result.PerformerFirstName} {result.PerformerLastName}".Trim();
          deliveryData.SetDriverInfo(result.PerformerDeviceId, driverName, result.PerformerPhone);
        }
        if (!string.IsNullOrWhiteSpace(result.RecipientCode))
        {
          deliveryData.SetRecipientCode(result.RecipientCode);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
      }
      catch (Exception persistEx)
      {
        _logger.LogCritical(persistEx,
          "JURA orphan risk! Created jura_order_id={JuraId} for order {OrderId} but local save failed. Attempting JURA cancel.",
          result.OrderId, order.Id);

        try { await transaction.RollbackAsync(CancellationToken.None); } catch { /* ignored */ }

        try
        {
          await _juraService.CancelOrderAsync(
            result.OrderId,
            "Local persistence failure — rollback",
            CancellationToken.None);
          _logger.LogWarning(
            "JURA order {JuraId} rolled back successfully after local save failure.",
            result.OrderId);
        }
        catch (Exception cancelEx)
        {
          _logger.LogCritical(cancelEx,
            "!!! DOUBLE FAILURE: JURA order {JuraId} created but neither saved locally nor cancelled remotely. Manual intervention required (order {OrderId}).",
            result.OrderId, order.Id);
        }

        throw;
      }

      _logger.LogInformation(
        "JURA delivery dispatched for order {OrderId} by worker {WorkerId}, JURA order {JuraOrderId}",
        order.Id, worker.Id, result.OrderId);

      return new DispatchDeliveryResponse
      {
        OrderId = order.Id,
        JuraOrderId = result.OrderId,
        JuraStatus = result.Status,
        JuraStatusId = result.StatusId,
        DeliveryCost = deliveryData.DeliveryCost,
        DriverName = deliveryData.DriverName,
        DriverPhone = deliveryData.DriverPhone,
        AlreadyDispatched = false
      };
    }
    catch
    {
      try { await transaction.RollbackAsync(CancellationToken.None); } catch { /* ignored */ }
      throw;
    }
  }

  public async Task<CancelDeliveryResponse> CancelDeliveryAsync(
    CancelDeliveryRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    if (_juraService is null)
      throw new InvalidOperationException("JURA service is not configured.");

    var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: false, cancellationToken);
    var order = await _dbContext.Orders
      .AsTracking()
      .Include(x => x.DeliveryData)
      .FirstOrDefaultAsync(x => x.Id == request.OrderId, cancellationToken)
      ?? throw new InvalidOperationException($"Order '{request.OrderId}' was not found.");

    if (order.PharmacyId != worker.PharmacyId)
      throw new InvalidOperationException(
        $"Order '{order.Id}' does not belong to worker pharmacy '{worker.PharmacyId}'.");

    var deliveryData = order.DeliveryData
      ?? throw new InvalidOperationException($"Order '{order.Id}' has no delivery data.");

    if (!deliveryData.JuraOrderId.HasValue)
      throw new InvalidOperationException("Delivery was not dispatched to JURA.");

    if (order.Status is Status.Delivered or Status.PickedUp or Status.Cancelled or Status.Returned)
      throw new InvalidOperationException(
        $"Cannot cancel delivery in order status '{order.Status}'.");

    var reason = string.IsNullOrWhiteSpace(request.Reason)
      ? "Pharmacy admin cancelled delivery"
      : request.Reason.Trim();

    try
    {
      await _juraService.CancelOrderAsync(deliveryData.JuraOrderId.Value, reason, cancellationToken);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex,
        "Failed to cancel JURA delivery for order {OrderId}, jura {JuraOrderId}",
        order.Id, deliveryData.JuraOrderId);
      throw;
    }

    deliveryData.ClearJuraDispatch();
    await _dbContext.SaveChangesAsync(cancellationToken);

    _logger.LogInformation(
      "JURA delivery cancelled for order {OrderId} by worker {WorkerId}",
      order.Id, worker.Id);

    return new CancelDeliveryResponse
    {
      OrderId = order.Id,
      Cancelled = true
    };
  }

  public async Task<List<JuraTariff>> GetDeliveryTariffsAsync(CancellationToken cancellationToken = default)
  {
    if (_juraService is null)
      throw new InvalidOperationException("JURA service is not configured.");
    return await _juraService.GetTariffsAsync(cancellationToken);
  }

  public async Task CancelOrderFromJuraAsync(
    Guid orderId,
    string reason,
    CancellationToken cancellationToken = default)
  {
    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .Include(x => x.DeliveryData)
        .FirstOrDefaultAsync(x => x.Id == orderId, cancellationToken)
        ?? throw new InvalidOperationException($"Order '{orderId}' was not found.");

      // Guard: don't double-cancel or touch terminal orders.
      if (order.Status is Status.Cancelled or Status.Delivered or Status.PickedUp or Status.Returned)
      {
        await transaction.RollbackAsync(cancellationToken);
        return;
      }

      var oldStatus = order.Status;
      order.Cancel();
      LogStatusTransition(order.Id, oldStatus, order.Status, $"CancelOrderFromJura:{reason}", Guid.Empty);

      var positionsToRestore = order.Positions.Where(x => !x.IsRejected).ToList();
      if (order.IsStockDeducted && positionsToRestore.Count > 0)
      {
        await RestoreStockForPositionsAsync(order.PharmacyId, positionsToRestore, cancellationToken);
        _logger.LogInformation(
          "Stock restored for JURA-cancelled order {OrderId}. Positions restored: {PositionsCount}.",
          order.Id, positionsToRestore.Count);
      }

      var deliveryCost = order.DeliveryData?.DeliveryCost ?? 0m;
      _ = CreateRefundRequestStub(order.Id, order.Cost + deliveryCost);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      _logger.LogWarning(
        "Order {OrderId} auto-cancelled due to JURA delivery cancellation. Refund amount: {Amount}.",
        order.Id, order.Cost + deliveryCost);
    }
    catch
    {
      try { await transaction.RollbackAsync(CancellationToken.None); } catch { /* ignored */ }
      throw;
    }
  }

  private async Task TryCancelJuraDeliveryAsync(DeliveryData? deliveryData, string reason, CancellationToken ct)
  {
    if (_juraService is null || deliveryData is null || !deliveryData.JuraOrderId.HasValue)
      return;

    try
    {
      await _juraService.CancelOrderAsync(deliveryData.JuraOrderId.Value, reason, ct);
      _logger.LogInformation(
        "JURA delivery cancelled (jura {JuraOrderId}) due to order cancellation",
        deliveryData.JuraOrderId);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex,
        "Could not cancel JURA delivery {JuraOrderId} on order cancellation — will need manual attention",
        deliveryData.JuraOrderId);
    }
  }

  public async Task<MarkOrderOnTheWayResponse> MarkOrderOnTheWayAsync(
    MarkOrderOnTheWayRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: true, cancellationToken);
      var order = await GetTrackedOrderForWorkerOrThrowAsync(request.OrderId, worker.PharmacyId, cancellationToken);

      if (order.Status != Status.Ready)
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in status '{Status.Ready}' to move on the way.");

      var oldStatus = order.Status;
      order.NextStage(true);
      LogStatusTransition(order.Id, oldStatus, order.Status, "MarkOrderOnTheWay", worker.Id);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new MarkOrderOnTheWayResponse
      {
        WorkerId = worker.Id,
        OrderId = order.Id,
        Status = order.Status
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<MarkOrderDeliveredBySuperAdminResponse> MarkOrderDeliveredBySuperAdminAsync(
    MarkOrderDeliveredBySuperAdminRequest request,
    CancellationToken cancellationToken = default)
  {
    return await MoveOrderBySuperAdminInternalAsync(
      request,
      [Status.OnTheWay],
      "MarkOrderDeliveredBySuperAdmin",
      cancellationToken);
  }

  public async Task<MarkOrderDeliveredBySuperAdminResponse> MoveOrderToNextStatusBySuperAdminAsync(
    MarkOrderDeliveredBySuperAdminRequest request,
    CancellationToken cancellationToken = default)
  {
    return await MoveOrderBySuperAdminInternalAsync(
      request,
      [Status.New, Status.OnTheWay],
      "MoveOrderToNextStatusBySuperAdmin",
      cancellationToken);
  }

  public async Task<DeleteNewOrderByAdminResponse> DeleteNewOrderByAdminAsync(
    DeleteNewOrderByAdminRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var worker = await GetWorkerOrThrowAsync(request.WorkerId, asTracking: true, cancellationToken);

      if (request.PharmacyId != Guid.Empty && request.PharmacyId != worker.PharmacyId)
        throw new InvalidOperationException(
          $"Worker '{worker.Id}' is not linked to pharmacy '{request.PharmacyId}'.");

      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .FirstOrDefaultAsync(x => x.Id == request.OrderId, cancellationToken)
        ?? throw new InvalidOperationException($"Order '{request.OrderId}' was not found.");

      if (order.PharmacyId != worker.PharmacyId)
        throw new InvalidOperationException(
          $"Order '{order.Id}' does not belong to worker pharmacy '{worker.PharmacyId}'.");

      if (order.Status != Status.New)
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in status '{Status.New}' to be deleted.");

      var positionsToRestore = order.Positions
        .Where(x => !x.IsRejected)
        .ToList();

      if (order.IsStockDeducted && positionsToRestore.Count > 0)
      {
        await RestoreStockForPositionsAsync(
          order.PharmacyId,
          positionsToRestore,
          cancellationToken);

        _logger.LogInformation(
          "Stock restored for deleted new order {OrderId}. Positions restored: {PositionsCount}.",
          order.Id,
          positionsToRestore.Count);
      }

      _dbContext.Orders.Remove(order);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      return new DeleteNewOrderByAdminResponse
      {
        WorkerId = worker.Id,
        OrderId = order.Id,
        IsDeleted = true
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<CancelOrderResponse> CancelOrderAsync(
    CancelOrderRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .Include(x => x.DeliveryData)
        .FirstOrDefaultAsync(
          x => x.Id == request.OrderId && x.ClientId == request.ClientId,
          cancellationToken)
        ?? throw new InvalidOperationException(
          $"Order '{request.OrderId}' for client '{request.ClientId}' was not found.");

      // "New" orders can only be cancelled by SuperAdmin (payment intent cleanup).
      // Clients may cancel from UnderReview onward.
      if (order.Status == Status.New)
        throw new ClientErrorException(
          errorCode: "client_cannot_cancel_new_order",
          detail: "Новый заказ (ожидает подтверждения оплаты) может отменить только администратор.",
          reason: "status_new");

      var oldStatus = order.Status;
      order.Cancel();
      LogStatusTransition(order.Id, oldStatus, order.Status, "CancelOrder", request.ClientId);

      var positionsToRestore = order.Positions
        .Where(x => !x.IsRejected)
        .ToList();

      if (order.IsStockDeducted && positionsToRestore.Count > 0)
      {
        await RestoreStockForPositionsAsync(
          order.PharmacyId,
          positionsToRestore,
          cancellationToken);

        _logger.LogInformation(
          "Stock restored for cancelled order {OrderId}. Positions restored: {PositionsCount}.",
          order.Id,
          positionsToRestore.Count);
      }

      var deliveryCost = order.DeliveryData?.DeliveryCost ?? 0m;
      var refundRequest = CreateRefundRequestStub(order.Id, order.Cost + deliveryCost);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await TryCancelJuraDeliveryAsync(order.DeliveryData, "Client cancelled order", cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new CancelOrderResponse
      {
        ClientId = request.ClientId,
        OrderId = order.Id,
        Status = order.Status,
        RefundRequest = refundRequest
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<CancelOrderResponse> CancelOrderByAdminAsync(
    Guid orderId,
    Guid pharmacyId,
    Guid actorUserId,
    CancellationToken cancellationToken = default)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("orderId can't be empty.");
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("pharmacyId can't be empty.");

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .Include(x => x.DeliveryData)
        .FirstOrDefaultAsync(
          x => x.Id == orderId && x.PharmacyId == pharmacyId,
          cancellationToken)
        ?? throw new InvalidOperationException(
          $"Order '{orderId}' was not found in pharmacy '{pharmacyId}'.");

      // Admin can cancel only orders in progress within the pharmacy
      // (not "New" — those are awaiting payment confirmation by SuperAdmin,
      // not "OnTheWay"/"Delivered"/"PickedUp"/"Returned"/"Cancelled").
      if (order.Status is not (Status.UnderReview or Status.Preparing or Status.Ready))
        throw new ClientErrorException(
          errorCode: "admin_cannot_cancel_in_this_status",
          detail: $"Администратор аптеки не может отменить заказ в статусе «{order.Status}».",
          reason: $"status:{order.Status}");

      var oldStatus = order.Status;
      order.Cancel();
      LogStatusTransition(order.Id, oldStatus, order.Status, "CancelOrderByAdmin", actorUserId);

      var positionsToRestore = order.Positions
        .Where(x => !x.IsRejected)
        .ToList();

      if (order.IsStockDeducted && positionsToRestore.Count > 0)
      {
        await RestoreStockForPositionsAsync(
          order.PharmacyId,
          positionsToRestore,
          cancellationToken);

        _logger.LogInformation(
          "Stock restored for admin-cancelled order {OrderId}. Positions restored: {PositionsCount}.",
          order.Id, positionsToRestore.Count);
      }

      var deliveryCost = order.DeliveryData?.DeliveryCost ?? 0m;
      var refundRequest = CreateRefundRequestStub(order.Id, order.Cost + deliveryCost);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await TryCancelJuraDeliveryAsync(order.DeliveryData, "Pharmacy admin cancelled order", cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new CancelOrderResponse
      {
        ClientId = order.ClientId ?? Guid.Empty,
        OrderId = order.Id,
        Status = order.Status,
        RefundRequest = refundRequest
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  public async Task<CancelOrderResponse> ReturnOrderPositionsBySuperAdminAsync(
    ReturnOrderPositionsRequest request,
    Guid actorUserId,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    if (request.OrderId == Guid.Empty)
      throw new DomainArgumentException("orderId can't be empty.");
    if (request.Positions is null || request.Positions.Count == 0)
      throw new DomainArgumentException("At least one position must be returned.");

    // Normalize + dedupe by positionId (last wins).
    var byPositionId = new Dictionary<Guid, int>();
    foreach (var line in request.Positions)
    {
      if (line.PositionId == Guid.Empty)
        throw new DomainArgumentException("PositionId can't be empty.");
      if (line.Quantity < 1)
        throw new DomainArgumentException("Returned quantity must be at least 1.");
      byPositionId[line.PositionId] = line.Quantity;
    }

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .FirstOrDefaultAsync(x => x.Id == request.OrderId, cancellationToken)
        ?? throw new InvalidOperationException($"Order '{request.OrderId}' was not found.");

      if (order.Status is not (Status.Delivered or Status.PickedUp or Status.Returned))
        throw new ClientErrorException(
          errorCode: "return_not_allowed_in_this_status",
          detail: $"Возврат возможен только для доставленных или забранных заказов (текущий статус: {order.Status}).",
          reason: $"status:{order.Status}");

      // Merge with existing returned quantities (idempotent: each call sets the
      // total returned for the given positions, not a delta).
      var oldStatus = order.Status;
      order.InitiateReturn(byPositionId);
      LogStatusTransition(order.Id, oldStatus, order.Status, "ReturnOrderPositionsBySuperAdmin", actorUserId);

      // Restock the returned units.
      var restockPositions = order.Positions
        .Where(p => !p.IsRejected && p.ReturnedQuantity > 0 && byPositionId.ContainsKey(p.Id))
        .Select(p => new ReturnedStockEntry(p.MedicineId, p.ReturnedQuantity))
        .GroupBy(x => x.MedicineId)
        .Select(g => new ReturnedStockEntry(g.Key, g.Sum(x => x.Quantity)))
        .ToList();

      foreach (var entry in restockPositions)
      {
        await _dbContext.Offers
          .Where(o => o.PharmacyId == order.PharmacyId && o.MedicineId == entry.MedicineId)
          .ExecuteUpdateAsync(
            setters => setters.SetProperty(o => o.StockQuantity, o => o.StockQuantity + entry.Quantity),
            cancellationToken);
      }

      // Refund = current ReturnCost (rejected + returned) recalculated by domain.
      var refundRequest = CreateRefundRequestStub(order.Id, order.ReturnCost);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new CancelOrderResponse
      {
        ClientId = order.ClientId ?? Guid.Empty,
        OrderId = order.Id,
        Status = order.Status,
        RefundRequest = refundRequest
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private sealed record ReturnedStockEntry(Guid MedicineId, int Quantity);

  public async Task<CancelOrderResponse> CancelOrderBySuperAdminAsync(
    Guid orderId,
    CancellationToken cancellationToken = default)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("orderId can't be empty.");

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var order = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .Include(x => x.DeliveryData)
        .FirstOrDefaultAsync(x => x.Id == orderId, cancellationToken)
        ?? throw new InvalidOperationException($"Order '{orderId}' was not found.");

      var oldStatus = order.Status;
      order.Cancel();
      LogStatusTransition(order.Id, oldStatus, order.Status, "CancelOrderBySuperAdmin", order.ClientId ?? Guid.Empty);

      var positionsToRestore = order.Positions
        .Where(x => !x.IsRejected)
        .ToList();

      if (order.IsStockDeducted && positionsToRestore.Count > 0)
      {
        await RestoreStockForPositionsAsync(
          order.PharmacyId,
          positionsToRestore,
          cancellationToken);

        _logger.LogInformation(
          "Stock restored for SA-cancelled order {OrderId}. Positions restored: {PositionsCount}.",
          order.Id,
          positionsToRestore.Count);
      }

      var deliveryCost = order.DeliveryData?.DeliveryCost ?? 0m;
      var refundRequest = CreateRefundRequestStub(order.Id, order.Cost + deliveryCost);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await TryCancelJuraDeliveryAsync(order.DeliveryData, "SuperAdmin cancelled order", cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new CancelOrderResponse
      {
        ClientId = order.ClientId ?? Guid.Empty,
        OrderId = order.Id,
        Status = order.Status,
        RefundRequest = refundRequest
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private async Task<PharmacyWorker> GetWorkerOrThrowAsync(
    Guid workerId,
    bool asTracking,
    CancellationToken cancellationToken)
  {
    IQueryable<PharmacyWorker> query = _dbContext.PharmacyWorkers;
    query = asTracking ? query.AsTracking() : query.AsNoTracking();

    var worker = await query.FirstOrDefaultAsync(x => x.Id == workerId, cancellationToken)
      ?? throw new InvalidOperationException($"PharmacyWorker '{workerId}' was not found.");

    if (worker.Role != Role.Admin)
      throw new InvalidOperationException($"PharmacyWorker '{workerId}' does not have Admin role.");

    return worker;
  }

  private async Task<Order> GetTrackedOrderForWorkerOrThrowAsync(
    Guid orderId,
    Guid pharmacyId,
    CancellationToken cancellationToken)
  {
    var order = await _dbContext.Orders
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == orderId, cancellationToken)
      ?? throw new InvalidOperationException($"Order '{orderId}' was not found.");

    if (order.PharmacyId != pharmacyId)
      throw new InvalidOperationException(
        $"Order '{orderId}' does not belong to worker pharmacy '{pharmacyId}'.");

    return order;
  }

  private async Task<User> GetSuperAdminOrThrowAsync(
    Guid superAdminId,
    bool asTracking,
    CancellationToken cancellationToken)
  {
    IQueryable<User> query = _dbContext.Users;
    query = asTracking ? query.AsTracking() : query.AsNoTracking();

    var superAdmin = await query.FirstOrDefaultAsync(x => x.Id == superAdminId, cancellationToken)
      ?? throw new InvalidOperationException($"SuperAdmin '{superAdminId}' was not found.");

    if (superAdmin.Role != Role.SuperAdmin)
      throw new InvalidOperationException($"User '{superAdminId}' does not have SuperAdmin role.");

    return superAdmin;
  }

  private async Task<MarkOrderDeliveredBySuperAdminResponse> MoveOrderBySuperAdminInternalAsync(
    MarkOrderDeliveredBySuperAdminRequest request,
    IReadOnlyCollection<Status> allowedStatuses,
    string action,
    CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(allowedStatuses);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var superAdmin = await GetSuperAdminOrThrowAsync(
        request.SuperAdminId,
        asTracking: true,
        cancellationToken);

      var order = await _dbContext.Orders
        .AsTracking()
        .FirstOrDefaultAsync(x => x.Id == request.OrderId, cancellationToken)
        ?? throw new InvalidOperationException($"Order '{request.OrderId}' was not found.");

      if (!allowedStatuses.Contains(order.Status))
      {
        var allowed = string.Join(", ", allowedStatuses);
        throw new InvalidOperationException(
          $"Order '{order.Id}' must be in one of statuses [{allowed}] for action '{action}'.");
      }

      if (order.Status == Status.New)
      {
        var nowUtc = DateTime.UtcNow;
        if (order.PaymentState == OrderPaymentState.Expired
          || (order.PaymentState == OrderPaymentState.PendingManualConfirmation
            && order.PaymentExpiresAtUtc.HasValue
            && order.PaymentExpiresAtUtc.Value <= nowUtc))
        {
          throw new InvalidOperationException(
            $"Order '{order.Id}' payment confirmation timeout exceeded.");
        }

        if (order.PaymentState == OrderPaymentState.PendingManualConfirmation)
        {
          order.ConfirmManualPayment(superAdmin.Id, nowUtc);
          _dbContext.PaymentHistories.Add(CreatePaymentHistory(order, superAdmin, nowUtc));
        }
      }

      var oldStatus = order.Status;
      order.NextStage(true);
      LogStatusTransition(order.Id, oldStatus, order.Status, action, superAdmin.Id);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
        order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);

      return new MarkOrderDeliveredBySuperAdminResponse
      {
        SuperAdminId = superAdmin.Id,
        OrderId = order.Id,
        Status = order.Status
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  /// Batch-load the Client rows referenced by a page of orders so the
  /// admin-facing mapping can surface customer name / phone / Telegram
  /// without issuing a query per row.
  private async Task<IReadOnlyDictionary<Guid, Client>> LoadClientsForOrdersAsync(
    IEnumerable<Order> orders,
    CancellationToken cancellationToken)
  {
    var clientIds = orders
      .Where(o => o.ClientId.HasValue)
      .Select(o => o.ClientId!.Value)
      .Distinct()
      .ToList();
    if (clientIds.Count == 0)
      return new Dictionary<Guid, Client>();
    var clients = await _dbContext.Clients
      .AsNoTracking()
      .Where(c => clientIds.Contains(c.Id))
      .ToListAsync(cancellationToken);
    return clients.ToDictionary(c => c.Id);
  }

  private static WorkerOrderResponse ToWorkerOrderResponse(
    Order order,
    IReadOnlyDictionary<Guid, Client>? clientsById = null)
  {
    var delivery = order.DeliveryData;
    var deliveryCost = delivery?.DeliveryCost ?? 0m;
    Client? client = null;
    if (clientsById is not null && order.ClientId.HasValue)
      clientsById.TryGetValue(order.ClientId.Value, out client);
    return new WorkerOrderResponse
    {
      OrderId = order.Id,
      ClientId = order.ClientId,
      ClientPhoneNumber = order.ClientPhoneNumber,
      ClientName = client?.Name,
      ClientTelegramId = client?.TelegramId,
      ClientTelegramUsername = client?.TelegramUsername,
      PharmacyId = order.PharmacyId,
      OrderPlacedAt = order.OrderPlacedAt,
      IsPickup = order.IsPickup,
      DeliveryAddress = order.DeliveryAddress,
      Status = order.Status,
      Cost = order.Cost,
      ReturnCost = order.ReturnCost,
      DeliveryCost = deliveryCost,
      DeliveryDistance = delivery?.Distance,
      TotalCost = order.Cost + deliveryCost,
      JuraOrderId = delivery?.JuraOrderId,
      JuraStatus = delivery?.JuraStatus,
      JuraStatusId = delivery?.JuraStatusId,
      DriverName = delivery?.DriverName,
      DriverPhone = delivery?.DriverPhone,
      FromLatitude = delivery?.FromLatitude,
      FromLongitude = delivery?.FromLongitude,
      ToLatitude = delivery?.ToLatitude,
      ToLongitude = delivery?.ToLongitude,
      Comment = order.Comment,
      Positions = order.Positions
        .Select(x => new WorkerOrderPositionResponse
        {
          PositionId = x.Id,
          MedicineId = x.MedicineId,
          Quantity = x.Quantity,
          ReturnedQuantity = x.ReturnedQuantity,
          IsRejected = x.IsRejected,
          Price = x.OfferSnapshot.Price,
          Medicine = x.Medicine is null
            ? new WorkerMedicineResponse
            {
              Id = x.MedicineId,
              Title = $"Medicine:{x.MedicineId}",
              Articul = string.Empty,
              Images = [],
              IsActive = true
            }
            : new WorkerMedicineResponse
            {
              Id = x.Medicine.Id,
              Title = x.Medicine.Title,
              Articul = x.Medicine.Articul,
              Images = x.Medicine.Images
                .Select(image => new MedicineImageResponse
                {
                  Id = image.Id,
                  Key = image.Key,
                  IsMain = image.IsMain,
                  IsMinimal = image.IsMinimal
                })
                .ToList(),
              IsActive = x.Medicine.IsActive
            }
        })
        .ToList()
    };
  }

  private static int NormalizeTake(int take)
  {
    if (take <= 0)
      return 50;

    return Math.Min(take, 200);
  }

  private static PaymentHistory CreatePaymentHistory(
    Order order,
    User superAdmin,
    DateTime paidAtUtc)
  {
    var amount = order.PaymentAmount > 0 ? order.PaymentAmount : order.Cost;
    return new PaymentHistory(
      orderId: order.Id,
      userId: order.ClientId,
      userPhoneNumber: order.ClientPhoneNumber,
      amount: amount,
      currency: string.IsNullOrWhiteSpace(order.PaymentCurrency) ? "TJS" : order.PaymentCurrency,
      provider: string.IsNullOrWhiteSpace(order.PaymentProvider) ? "DushanbeCityManualPhone" : order.PaymentProvider,
      receiverAccount: string.IsNullOrWhiteSpace(order.PaymentReceiverAccount) ? "unknown" : order.PaymentReceiverAccount,
      paymentUrl: order.PaymentUrl,
      paymentComment: order.PaymentComment,
      confirmedByUserId: superAdmin.Id,
      confirmedByPhoneNumber: superAdmin.PhoneNumber,
      paidAtUtc: paidAtUtc);
  }

  private static RefundRequestStubResponse CreateRefundRequestStub(Guid orderId, decimal amount)
  {
    return new RefundRequestStubResponse
    {
      RefundRequestId = Guid.NewGuid(),
      OrderId = orderId,
      Amount = amount,
      CreatedAtUtc = DateTime.UtcNow,
      Status = "CreatedStub"
    };
  }

  private async Task RestoreStockForPositionsAsync(
    Guid pharmacyId,
    IReadOnlyCollection<OrderPosition> positions,
    CancellationToken cancellationToken)
  {
    var restoreByMedicineId = positions
      .GroupBy(x => x.MedicineId)
      .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

    foreach (var restoreItem in restoreByMedicineId)
    {
      var affectedRows = await _dbContext.Offers
        .Where(x =>
          x.PharmacyId == pharmacyId &&
          x.MedicineId == restoreItem.Key)
        .ExecuteUpdateAsync(
          setters => setters.SetProperty(
            x => x.StockQuantity,
            x => x.StockQuantity + restoreItem.Value),
          cancellationToken);

      if (affectedRows == 0)
      {
        throw new InvalidOperationException(
          $"Offer for medicine '{restoreItem.Key}' in pharmacy '{pharmacyId}' was not found while restoring stock.");
      }
    }
  }

  private void LogStatusTransition(
    Guid orderId,
    Status fromStatus,
    Status toStatus,
    string action,
    Guid actorId)
  {
    _logger.LogInformation(
      "Order {OrderId} status transition ({Action}) by actor {ActorId}: {FromStatus} -> {ToStatus}.",
      orderId,
      action,
      actorId,
      fromStatus,
      toStatus);
  }
}
