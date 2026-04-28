using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.Services;

public sealed class PaymentIntentService : IPaymentIntentService
{
  private readonly IAppDbContext _dbContext;
  private readonly IRealtimeUpdatesPublisher _realtimeUpdatesPublisher;
  private readonly IOrderStatusSmsService _orderStatusSmsService;
  private readonly SmsTemplatesOptions _smsTemplatesOptions;
  private readonly ILogger<PaymentIntentService> _logger;

  public PaymentIntentService(IAppDbContext dbContext)
    : this(
      dbContext,
      new NoOpRealtimeUpdatesPublisher(),
      new OrderStatusSmsService(Options.Create(new SmsTemplatesOptions())),
      Options.Create(new SmsTemplatesOptions()),
      NullLogger<PaymentIntentService>.Instance)
  {
  }

  public PaymentIntentService(
    IAppDbContext dbContext,
    IRealtimeUpdatesPublisher realtimeUpdatesPublisher,
    IOrderStatusSmsService orderStatusSmsService,
    IOptions<SmsTemplatesOptions> smsTemplatesOptions,
    ILogger<PaymentIntentService> logger)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(realtimeUpdatesPublisher);
    ArgumentNullException.ThrowIfNull(orderStatusSmsService);
    ArgumentNullException.ThrowIfNull(smsTemplatesOptions);
    ArgumentNullException.ThrowIfNull(logger);

    _dbContext = dbContext;
    _realtimeUpdatesPublisher = realtimeUpdatesPublisher;
    _orderStatusSmsService = orderStatusSmsService;
    _smsTemplatesOptions = smsTemplatesOptions.Value;
    _logger = logger;
  }

  public async Task<GetPaymentIntentByIdResponse> GetForClientAsync(
    GetClientPaymentIntentByIdRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var paymentIntent = await _dbContext.PaymentIntents
      .AsNoTracking()
      .Include(x => x.Positions)
      .FirstOrDefaultAsync(
        x => x.Id == request.PaymentIntentId && x.ClientId == request.ClientId,
        cancellationToken)
      ?? throw new InvalidOperationException(
        $"PaymentIntent '{request.PaymentIntentId}' for client '{request.ClientId}' was not found.");

    var orderId = await _dbContext.Orders
      .AsNoTracking()
      .Where(x => x.Id == paymentIntent.ReservedOrderId)
      .Select(x => (Guid?)x.Id)
      .FirstOrDefaultAsync(cancellationToken);

    return new GetPaymentIntentByIdResponse
    {
      PaymentIntent = ToResponse(paymentIntent),
      OrderId = orderId
    };
  }

  public async Task<GetPaymentIntentByIdResponse> GetForSuperAdminAsync(
    GetSuperAdminPaymentIntentByIdRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    await GetSuperAdminOrThrowAsync(request.SuperAdminId, asTracking: false, cancellationToken);

    var paymentIntent = await _dbContext.PaymentIntents
      .AsNoTracking()
      .Include(x => x.Positions)
      .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken)
      ?? throw new InvalidOperationException($"PaymentIntent '{request.PaymentIntentId}' was not found.");

    var orderId = await _dbContext.Orders
      .AsNoTracking()
      .Where(x => x.Id == paymentIntent.ReservedOrderId)
      .Select(x => (Guid?)x.Id)
      .FirstOrDefaultAsync(cancellationToken);

    return new GetPaymentIntentByIdResponse
    {
      PaymentIntent = ToResponse(paymentIntent),
      OrderId = orderId
    };
  }

  public async Task<GetPaymentIntentsResponse> GetForSuperAdminAsync(
    GetSuperAdminPaymentIntentsRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    await GetSuperAdminOrThrowAsync(request.SuperAdminId, asTracking: false, cancellationToken);

    var page = request.Page < 1 ? 1 : request.Page;
    var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

    var query = _dbContext.PaymentIntents
      .AsNoTracking()
      .AsQueryable();

    if (request.States.Count > 0)
      query = query.Where(x => request.States.Contains(x.State));

    var totalCount = await query.CountAsync(cancellationToken);
    var paymentIntents = await query
      .Include(x => x.Positions)
      .OrderByDescending(x => x.CreatedAtUtc)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);

    return new GetPaymentIntentsResponse
    {
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      PaymentIntents = paymentIntents.Select(ToResponse).ToList()
    };
  }

  public async Task<ConfirmPaymentIntentBySuperAdminResponse> ConfirmBySuperAdminAsync(
    ConfirmPaymentIntentBySuperAdminRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var superAdmin = await GetSuperAdminOrThrowAsync(
        request.SuperAdminId,
        asTracking: true,
        cancellationToken);

      var paymentIntent = await _dbContext.PaymentIntents
        .AsTracking()
        .Include(x => x.Positions)
        .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken)
        ?? throw new InvalidOperationException($"PaymentIntent '{request.PaymentIntentId}' was not found.");

      var existingOrder = await _dbContext.Orders
        .AsTracking()
        .Include(x => x.Positions)
        .FirstOrDefaultAsync(x => x.Id == paymentIntent.ReservedOrderId, cancellationToken);

      if (paymentIntent.State == PaymentIntentState.Confirmed)
      {
        await transaction.CommitAsync(cancellationToken);
        return new ConfirmPaymentIntentBySuperAdminResponse
        {
          PaymentIntentId = paymentIntent.Id,
          ReservedOrderId = paymentIntent.ReservedOrderId,
          OrderCreated = false,
          PaymentIntentState = paymentIntent.State,
          OrderStatus = existingOrder?.Status,
          Message = "Payment intent already confirmed."
        };
      }

      if (paymentIntent.State != PaymentIntentState.AwaitingAdminConfirmation)
      {
        throw new InvalidOperationException(
          $"PaymentIntent '{paymentIntent.Id}' must be in '{PaymentIntentState.AwaitingAdminConfirmation}' state to confirm.");
      }

      if (existingOrder is not null && existingOrder.Status == Status.Cancelled)
      {
        var expiredReason = $"Order '{existingOrder.Id}' was cancelled/expired before payment confirmation.";
        paymentIntent.MarkNeedsResolution(expiredReason, DateTime.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await PublishPaymentIntentUpdatedSafeAsync(paymentIntent, null, cancellationToken);
        return BuildNeedsResolutionResponse(paymentIntent, expiredReason);
      }

      var nowUtc = DateTime.UtcNow;
      var groupedByMedicine = paymentIntent.Positions
        .GroupBy(x => x.MedicineId)
        .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

      var medicineIds = groupedByMedicine.Keys.ToList();
      var medicines = await _dbContext.Medicines
        .AsTracking()
        .Where(x => medicineIds.Contains(x.Id))
        .ToListAsync(cancellationToken);

      var medicineById = medicines.ToDictionary(x => x.Id, x => x);
      var missingMedicines = medicineIds.Where(x => !medicineById.ContainsKey(x)).ToList();
      if (missingMedicines.Count > 0)
      {
        var reason = $"Missing medicines for payment intent '{paymentIntent.Id}': {string.Join(", ", missingMedicines)}.";
        paymentIntent.MarkNeedsResolution(reason, nowUtc);
        if (existingOrder is not null && existingOrder.Status != Status.Cancelled)
            existingOrder.Cancel();
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await PublishPaymentIntentUpdatedSafeAsync(paymentIntent, null, cancellationToken);
        return BuildNeedsResolutionResponse(paymentIntent, reason);
      }

      if (medicineById.Values.Any(x => !x.IsActive))
      {
        var inactiveIds = medicineById.Values.Where(x => !x.IsActive).Select(x => x.Id).ToList();
        var reason = $"Inactive medicines for payment intent '{paymentIntent.Id}': {string.Join(", ", inactiveIds)}.";
        paymentIntent.MarkNeedsResolution(reason, nowUtc);
        if (existingOrder is not null && existingOrder.Status != Status.Cancelled)
            existingOrder.Cancel();
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await PublishPaymentIntentUpdatedSafeAsync(paymentIntent, null, cancellationToken);
        return BuildNeedsResolutionResponse(paymentIntent, reason);
      }

      var offers = await _dbContext.Offers
        .AsNoTracking()
        .Where(x => x.PharmacyId == paymentIntent.PharmacyId && medicineIds.Contains(x.MedicineId))
        .ToDictionaryAsync(x => x.MedicineId, x => x.StockQuantity, cancellationToken);

      var insufficient = groupedByMedicine
        .Where(x => !offers.TryGetValue(x.Key, out var stock) || stock < x.Value)
        .ToList();

      if (insufficient.Count > 0)
      {
        var reason = BuildInsufficientStockReason(paymentIntent.Id, insufficient, offers);
        paymentIntent.MarkNeedsResolution(reason, nowUtc);
        if (existingOrder is not null && existingOrder.Status != Status.Cancelled)
            existingOrder.Cancel();
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await PublishPaymentIntentUpdatedSafeAsync(paymentIntent, null, cancellationToken);
        return BuildNeedsResolutionResponse(paymentIntent, reason);
      }

      foreach (var entry in groupedByMedicine)
      {
        var affectedRows = await _dbContext.Offers
          .Where(x =>
            x.PharmacyId == paymentIntent.PharmacyId
            && x.MedicineId == entry.Key
            && x.StockQuantity >= entry.Value)
          .ExecuteUpdateAsync(
            setters => setters.SetProperty(
              x => x.StockQuantity,
              x => x.StockQuantity - entry.Value),
            cancellationToken);

        if (affectedRows == 0)
        {
          throw new ConcurrentStockUpdateException(entry.Key);
        }
      }

      if (existingOrder is not null)
      {
        existingOrder.ConfirmManualPayment(superAdmin.Id, nowUtc);
        existingOrder.MarkStockDeducted();
        existingOrder.NextStage(true);
      }
      else
      {
        var orderPositions = paymentIntent.Positions
          .Select(x => new OrderPosition(
            orderId: paymentIntent.ReservedOrderId,
            medicineId: x.MedicineId,
            medicine: medicineById[x.MedicineId],
            offerSnapshot: new OfferSnapshot(x.OfferPharmacyId, x.OfferPrice),
            quantity: x.Quantity,
            isRejected: false))
          .ToList();

        existingOrder = new Order(
          id: paymentIntent.ReservedOrderId,
          clientId: paymentIntent.ClientId,
          clientPhoneNumber: paymentIntent.ClientPhoneNumber,
          pharmacyId: paymentIntent.PharmacyId,
          deliveryAddress: paymentIntent.DeliveryAddress,
          positions: orderPositions,
          idempotencyKey: paymentIntent.IdempotencyKey,
          orderPlacedAt: nowUtc,
          isPickup: paymentIntent.IsPickup,
          entrance: paymentIntent.Entrance,
          floor: paymentIntent.Floor,
          apartment: paymentIntent.Apartment);

        existingOrder.MarkManualPaymentConfirmed(
          amount: paymentIntent.Amount,
          currency: paymentIntent.Currency,
          provider: paymentIntent.PaymentProvider,
          receiverAccount: paymentIntent.PaymentReceiverAccount,
          paymentUrl: paymentIntent.PaymentUrl,
          paymentComment: paymentIntent.PaymentComment,
          confirmedByUserId: superAdmin.Id,
          confirmedAtUtc: nowUtc);

        _dbContext.Orders.Add(existingOrder);
      }

      _dbContext.PaymentHistories.Add(new PaymentHistory(
        orderId: existingOrder.Id,
        userId: paymentIntent.ClientId,
        userPhoneNumber: paymentIntent.ClientPhoneNumber,
        amount: paymentIntent.Amount,
        currency: paymentIntent.Currency,
        provider: paymentIntent.PaymentProvider,
        receiverAccount: paymentIntent.PaymentReceiverAccount,
        paymentUrl: paymentIntent.PaymentUrl,
        paymentComment: paymentIntent.PaymentComment,
        confirmedByUserId: superAdmin.Id,
        confirmedByPhoneNumber: superAdmin.PhoneNumber,
        paidAtUtc: nowUtc));

      paymentIntent.MarkConfirmed(superAdmin.Id, nowUtc);
      EnqueuePaymentConfirmedSms(existingOrder, paymentIntent.ClientPhoneNumber, nowUtc);

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);
      await PublishPaymentIntentUpdatedSafeAsync(paymentIntent, existingOrder.Id, cancellationToken);

      _logger.LogInformation(
        "Payment intent confirmed. PaymentIntentId={PaymentIntentId}, ReservedOrderId={ReservedOrderId}, SuperAdminId={SuperAdminId}, SmsEnqueuedForPhone={Phone}",
        paymentIntent.Id,
        paymentIntent.ReservedOrderId,
        superAdmin.Id,
        paymentIntent.ClientPhoneNumber);

      return new ConfirmPaymentIntentBySuperAdminResponse
      {
        PaymentIntentId = paymentIntent.Id,
        ReservedOrderId = paymentIntent.ReservedOrderId,
        OrderCreated = true,
        PaymentIntentState = paymentIntent.State,
        OrderStatus = existingOrder!.Status,
        Message = "Payment confirmed and order updated."
      };
    }
    catch (ConcurrentStockUpdateException concurrentException)
    {
      await transaction.RollbackAsync(cancellationToken);
      TryClearChangeTracker();

      var paymentIntent = await _dbContext.PaymentIntents
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken);

      if (paymentIntent is null)
        throw;

      var existingOrder = await _dbContext.Orders
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.Id == paymentIntent.ReservedOrderId, cancellationToken);

      if (paymentIntent.State == PaymentIntentState.Confirmed && existingOrder is not null)
      {
        return new ConfirmPaymentIntentBySuperAdminResponse
        {
          PaymentIntentId = paymentIntent.Id,
          ReservedOrderId = paymentIntent.ReservedOrderId,
          OrderCreated = false,
          PaymentIntentState = paymentIntent.State,
          OrderStatus = existingOrder.Status,
          Message = "Payment intent already processed by another request."
        };
      }

      var trackedPaymentIntent = await _dbContext.PaymentIntents
        .AsTracking()
        .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken);

      if (trackedPaymentIntent is null)
        throw;

      if (trackedPaymentIntent.State == PaymentIntentState.AwaitingAdminConfirmation)
      {
        var reason = $"Insufficient stock due to concurrent confirmation for medicine '{concurrentException.MedicineId}'.";
        trackedPaymentIntent.MarkNeedsResolution(reason, DateTime.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await PublishPaymentIntentUpdatedSafeAsync(trackedPaymentIntent, null, cancellationToken);

        return BuildNeedsResolutionResponse(trackedPaymentIntent, reason);
      }

      throw;
    }
    catch (DbUpdateException)
    {
      await transaction.RollbackAsync(cancellationToken);
      TryClearChangeTracker();

      var paymentIntent = await _dbContext.PaymentIntents
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken);

      if (paymentIntent is null)
        throw;

      var existingOrder = await _dbContext.Orders
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.Id == paymentIntent.ReservedOrderId, cancellationToken);

      if (paymentIntent.State == PaymentIntentState.Confirmed && existingOrder is not null)
      {
        return new ConfirmPaymentIntentBySuperAdminResponse
        {
          PaymentIntentId = paymentIntent.Id,
          ReservedOrderId = paymentIntent.ReservedOrderId,
          OrderCreated = false,
          PaymentIntentState = paymentIntent.State,
          OrderStatus = existingOrder.Status,
          Message = "Payment intent already processed by another request."
        };
      }

      throw;
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      TryClearChangeTracker();

      var paymentIntent = await _dbContext.PaymentIntents
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken);

      if (paymentIntent is not null)
      {
        var existingOrder = await _dbContext.Orders
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.Id == paymentIntent.ReservedOrderId, cancellationToken);

        if (existingOrder is not null)
        {
          if (paymentIntent.State != PaymentIntentState.Confirmed)
          {
            var trackedPaymentIntent = await _dbContext.PaymentIntents
              .AsTracking()
              .FirstOrDefaultAsync(x => x.Id == paymentIntent.Id, cancellationToken);

            if (trackedPaymentIntent is not null && trackedPaymentIntent.State == PaymentIntentState.AwaitingAdminConfirmation)
            {
              trackedPaymentIntent.MarkConfirmed(request.SuperAdminId, DateTime.UtcNow);
              await _dbContext.SaveChangesAsync(cancellationToken);
              await PublishPaymentIntentUpdatedSafeAsync(trackedPaymentIntent, existingOrder.Id, cancellationToken);
            }
          }

          return new ConfirmPaymentIntentBySuperAdminResponse
          {
            PaymentIntentId = paymentIntent.Id,
            ReservedOrderId = paymentIntent.ReservedOrderId,
            OrderCreated = false,
            PaymentIntentState = paymentIntent.State == PaymentIntentState.Confirmed
              ? paymentIntent.State
              : PaymentIntentState.Confirmed,
            OrderStatus = existingOrder.Status,
            Message = "Payment intent already processed by another request."
          };
        }
      }

      throw;
    }
  }

  public async Task<RejectPaymentIntentBySuperAdminResponse> RejectBySuperAdminAsync(
    RejectPaymentIntentBySuperAdminRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    await GetSuperAdminOrThrowAsync(request.SuperAdminId, asTracking: false, cancellationToken);

    var paymentIntent = await _dbContext.PaymentIntents
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == request.PaymentIntentId, cancellationToken)
      ?? throw new InvalidOperationException($"PaymentIntent '{request.PaymentIntentId}' was not found.");

    if (paymentIntent.State == PaymentIntentState.Confirmed)
      throw new InvalidOperationException("Confirmed payment intent can't be rejected.");

    var nowUtc = DateTime.UtcNow;
    paymentIntent.MarkRejected(request.Reason, nowUtc);

    var order = await _dbContext.Orders
      .AsTracking()
      .Include(x => x.Positions)
      .FirstOrDefaultAsync(x => x.Id == paymentIntent.ReservedOrderId, cancellationToken);

    if (order is not null && order.Status != Status.Cancelled)
    {
        order.MarkManualPaymentExpired(nowUtc);
        order.Cancel();
        await RestoreBasketPositionsFromOrderAsync(order, cancellationToken);
    }

    await _dbContext.SaveChangesAsync(cancellationToken);
    await PublishPaymentIntentUpdatedSafeAsync(paymentIntent, null, cancellationToken);

    if (order is not null)
    {
        await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
          order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);
    }

    _logger.LogInformation(
      "Payment intent rejected. PaymentIntentId={PaymentIntentId}, SuperAdminId={SuperAdminId}",
      paymentIntent.Id,
      request.SuperAdminId);

    return new RejectPaymentIntentBySuperAdminResponse
    {
      PaymentIntentId = paymentIntent.Id,
      ReservedOrderId = paymentIntent.ReservedOrderId,
      PaymentIntentState = paymentIntent.State,
      RejectReason = paymentIntent.RejectReason
    };
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

  private static ConfirmPaymentIntentBySuperAdminResponse BuildNeedsResolutionResponse(
    PaymentIntent paymentIntent,
    string reason)
  {
    return new ConfirmPaymentIntentBySuperAdminResponse
    {
      PaymentIntentId = paymentIntent.Id,
      ReservedOrderId = paymentIntent.ReservedOrderId,
      OrderCreated = false,
      PaymentIntentState = paymentIntent.State,
      OrderStatus = null,
      Message = reason
    };
  }

  private async Task PublishPaymentIntentUpdatedSafeAsync(
    PaymentIntent paymentIntent,
    Guid? orderId,
    CancellationToken cancellationToken)
  {
    try
    {
      await _realtimeUpdatesPublisher.PublishPaymentIntentUpdatedAsync(
        paymentIntentId: paymentIntent.Id,
        clientId: paymentIntent.ClientId,
        state: paymentIntent.State,
        orderId: orderId,
        cancellationToken: cancellationToken);
    }
    catch (Exception exception)
    {
      _logger.LogWarning(
        exception,
        "Failed to publish payment intent update via realtime channel. PaymentIntentId={PaymentIntentId}, State={State}, ClientId={ClientId}",
        paymentIntent.Id,
        paymentIntent.State,
        paymentIntent.ClientId);
    }
  }

  private static string BuildInsufficientStockReason(
    Guid paymentIntentId,
    IReadOnlyCollection<KeyValuePair<Guid, int>> insufficient,
    IReadOnlyDictionary<Guid, int> availableByMedicine)
  {
    var parts = insufficient.Select(x =>
    {
      availableByMedicine.TryGetValue(x.Key, out var available);
      return $"{x.Key} (required={x.Value}, available={available})";
    });

    return $"Insufficient stock for payment intent '{paymentIntentId}': {string.Join("; ", parts)}.";
  }

  private static PaymentIntentResponse ToResponse(PaymentIntent paymentIntent)
  {
    return new PaymentIntentResponse
    {
      Id = paymentIntent.Id,
      ReservedOrderId = paymentIntent.ReservedOrderId,
      ClientId = paymentIntent.ClientId,
      ClientPhoneNumber = paymentIntent.ClientPhoneNumber,
      PharmacyId = paymentIntent.PharmacyId,
      IsPickup = paymentIntent.IsPickup,
      DeliveryAddress = paymentIntent.DeliveryAddress,
      Amount = paymentIntent.Amount,
      Currency = paymentIntent.Currency,
      PaymentProvider = paymentIntent.PaymentProvider,
      PaymentReceiverAccount = paymentIntent.PaymentReceiverAccount,
      PaymentUrl = paymentIntent.PaymentUrl,
      PaymentComment = paymentIntent.PaymentComment,
      State = paymentIntent.State,
      IdempotencyKey = paymentIntent.IdempotencyKey,
      CreatedAtUtc = paymentIntent.CreatedAtUtc,
      UpdatedAtUtc = paymentIntent.UpdatedAtUtc,
      ConfirmedAtUtc = paymentIntent.ConfirmedAtUtc,
      ConfirmedByUserId = paymentIntent.ConfirmedByUserId,
      RejectReason = paymentIntent.RejectReason,
      Positions = paymentIntent.Positions
        .Select(x => new PaymentIntentPositionResponse
        {
          Id = x.Id,
          MedicineId = x.MedicineId,
          OfferPharmacyId = x.OfferPharmacyId,
          OfferPrice = x.OfferPrice,
          Quantity = x.Quantity
        })
        .ToList()
    };
  }

  private void EnqueuePaymentConfirmedSms(Order order, string phoneNumber, DateTime nowUtc)
  {
    var message = _orderStatusSmsService.BuildPaymentConfirmedMessage(
      order.Id,
      order.PaymentAmount,
      order.PaymentCurrency);

    if (string.IsNullOrWhiteSpace(message))
    {
      _logger.LogWarning(
        "Payment confirmation SMS template is empty. SMS won't be enqueued. OrderId={OrderId}",
        order.Id);
      return;
    }

    var provider = ResolveSmsProvider();
    var outboxMessage = SmsOutboxMessage.CreatePending(
      orderId: order.Id,
      phoneNumber: phoneNumber,
      statusSnapshot: Status.New,
      message: message,
      provider: provider,
      nowUtc: nowUtc);

    _dbContext.SmsOutboxMessages.Add(outboxMessage);
  }

  private string ResolveSmsProvider()
  {
    return string.IsNullOrWhiteSpace(_smsTemplatesOptions.Provider)
      ? "OsonSms"
      : _smsTemplatesOptions.Provider.Trim();
  }

  private void TryClearChangeTracker()
  {
    if (_dbContext is DbContext efDbContext)
      efDbContext.ChangeTracker.Clear();
  }

  private async Task RestoreBasketPositionsFromOrderAsync(
    Order order,
    CancellationToken cancellationToken)
  {
    if (!order.ClientId.HasValue)
      return;

    var clientId = order.ClientId.Value;
    var acceptedByMedicine = order.Positions
      .Where(x => !x.IsRejected)
      .GroupBy(x => x.MedicineId)
      .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

    if (acceptedByMedicine.Count == 0)
      return;

    var medicineIds = acceptedByMedicine.Keys.ToList();
    var existingPositions = await _dbContext.BasketPositions
      .AsTracking()
      .Where(x => x.ClientId == clientId && medicineIds.Contains(x.MedicineId))
      .ToListAsync(cancellationToken);

    var existingByMedicine = existingPositions.ToDictionary(x => x.MedicineId, x => x);
    foreach (var item in acceptedByMedicine)
    {
      if (existingByMedicine.TryGetValue(item.Key, out var position))
      {
        position.SetQuantity(position.Quantity + item.Value);
      }
      else
      {
        _dbContext.BasketPositions.Add(new BasketPosition(
          clientId,
          item.Key,
          medicine: null,
          quantity: item.Value));
      }
    }
  }

  private sealed class ConcurrentStockUpdateException : Exception
  {
    public ConcurrentStockUpdateException(Guid medicineId)
      : base($"Concurrent stock update detected for medicine '{medicineId}'.")
    {
      MedicineId = medicineId;
    }

    public Guid MedicineId { get; }
  }
}
