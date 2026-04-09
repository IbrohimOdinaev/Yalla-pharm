using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

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
      .OrderByDescending(x => x.OrderPlacedAt)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);

    return new GetAllOrdersResponse
    {
      Status = request.Status,
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      Orders = orders
        .Select(ToWorkerOrderResponse)
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
      DeliveryCost = delivery?.DeliveryCost ?? 0m,
      DriverName = delivery?.DriverName,
      DriverPhone = delivery?.DriverPhone,
      JuraStatus = delivery?.JuraStatus,
      Positions = order.Positions
        .Select(x => new ClientOrderDetailsPositionResponse
        {
          PositionId = x.Id,
          MedicineId = x.MedicineId,
          MedicineTitle = x.Medicine?.Title ?? $"Medicine:{x.MedicineId}",
          Quantity = x.Quantity,
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
      .OrderByDescending(x => x.OrderPlacedAt)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);

    return new GetPharmacyOrdersResponse
    {
      WorkerId = worker.Id,
      PharmacyId = worker.PharmacyId,
      Status = request.Status,
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      Orders = orders
        .Select(ToWorkerOrderResponse)
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
      .OrderByDescending(x => x.OrderPlacedAt)
      .Take(take)
      .ToListAsync(cancellationToken);

    return new GetNewOrdersForWorkerResponse
    {
      WorkerId = worker.Id,
      PharmacyId = worker.PharmacyId,
      Orders = orders
        .Select(ToWorkerOrderResponse)
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

      return new RejectOrderPositionsResponse
      {
        WorkerId = worker.Id,
        OrderId = order.Id,
        RejectedPositionIds = positionIds,
        Order = ToWorkerOrderResponse(order),
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

      if (!order.IsPickup && _juraService != null)
      {
        await DispatchJuraDeliveryAsync(order, cancellationToken);
      }

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

  private async Task DispatchJuraDeliveryAsync(Order order, CancellationToken ct)
  {
    try
    {
      var deliveryData = await _dbContext.DeliveryData
        .FirstOrDefaultAsync(d => d.OrderId == order.Id, ct);

      if (deliveryData == null)
      {
        _logger.LogWarning("No DeliveryData found for order {OrderId}, skipping JURA dispatch", order.Id);
        return;
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

      var result = await _juraService!.CreateDeliveryOrderAsync(from, to, tariffId: null, clientPhone, ct);

      deliveryData.SetJuraOrder(result.OrderId, result.Status, result.StatusId);

      if (result.PerformerDeviceId.HasValue)
      {
        var driverName = $"{result.PerformerFirstName} {result.PerformerLastName}".Trim();
        deliveryData.SetDriverInfo(result.PerformerDeviceId, driverName, result.PerformerPhone);
      }

      await _dbContext.SaveChangesAsync(ct);

      _logger.LogInformation("JURA delivery dispatched for order {OrderId}, JURA order {JuraOrderId}",
        order.Id, result.OrderId);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Failed to dispatch JURA delivery for order {OrderId}", order.Id);
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
        .FirstOrDefaultAsync(
          x => x.Id == request.OrderId && x.ClientId == request.ClientId,
          cancellationToken)
        ?? throw new InvalidOperationException(
          $"Order '{request.OrderId}' for client '{request.ClientId}' was not found.");

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

      var refundRequest = CreateRefundRequestStub(order.Id, order.Cost);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

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

  private static WorkerOrderResponse ToWorkerOrderResponse(Order order)
  {
    return new WorkerOrderResponse
    {
      OrderId = order.Id,
      ClientId = order.ClientId,
      ClientPhoneNumber = order.ClientPhoneNumber,
      PharmacyId = order.PharmacyId,
      OrderPlacedAt = order.OrderPlacedAt,
      IsPickup = order.IsPickup,
      DeliveryAddress = order.DeliveryAddress,
      Status = order.Status,
      Cost = order.Cost,
      ReturnCost = order.ReturnCost,
      Positions = order.Positions
        .Select(x => new WorkerOrderPositionResponse
        {
          PositionId = x.Id,
          MedicineId = x.MedicineId,
          Quantity = x.Quantity,
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
