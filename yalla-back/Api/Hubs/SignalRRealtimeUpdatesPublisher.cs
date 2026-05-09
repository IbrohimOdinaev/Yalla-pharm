using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Yalla.Application.Abstractions;
using Yalla.Domain.Enums;

namespace Api.Hubs;

public sealed class SignalRRealtimeUpdatesPublisher : IRealtimeUpdatesPublisher
{
  private readonly IHubContext<UpdatesHub> _hubContext;
  private readonly ILogger<SignalRRealtimeUpdatesPublisher> _logger;

  public SignalRRealtimeUpdatesPublisher(
    IHubContext<UpdatesHub> hubContext,
    ILogger<SignalRRealtimeUpdatesPublisher> logger)
  {
    ArgumentNullException.ThrowIfNull(hubContext);
    ArgumentNullException.ThrowIfNull(logger);
    _hubContext = hubContext;
    _logger = logger;
  }

  public async Task PublishPaymentIntentUpdatedAsync(
    Guid paymentIntentId,
    Guid clientId,
    PaymentIntentState state,
    Guid? orderId,
    CancellationToken cancellationToken = default)
  {
    var payload = new
    {
      paymentIntentId,
      state = (int)state,
      orderId
    };

    var clientTask = _hubContext.Clients
      .User(clientId.ToString())
      .SendAsync("PaymentIntentUpdated", payload, cancellationToken);

    var superAdminTask = _hubContext.Clients
      .Group(UpdatesHub.SuperAdminGroup)
      .SendAsync("PaymentIntentUpdated", payload, cancellationToken);

    await Task.WhenAll(clientTask, superAdminTask);
  }

  public async Task PublishOfferUpdatedAsync(
    Guid medicineId, Guid pharmacyId, decimal price, int stockQuantity,
    CancellationToken cancellationToken = default)
  {
    try
    {
      await _hubContext.Clients.All.SendAsync("OfferUpdated", new
      {
        medicineId, pharmacyId, price, stockQuantity
      }, cancellationToken);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish OfferUpdated for medicine {MedicineId}", medicineId);
    }
  }

  public async Task PublishOrderStatusChangedAsync(
    Guid orderId, string status, Guid? clientId, Guid pharmacyId,
    CancellationToken cancellationToken = default)
  {
    try
    {
      var payload = new { orderId, status, clientId, pharmacyId };
      var tasks = new List<Task>
      {
        _hubContext.Clients.Group(UpdatesHub.SuperAdminGroup).SendAsync("OrderStatusChanged", payload, cancellationToken),
        _hubContext.Clients.Group($"pharmacy:{pharmacyId}").SendAsync("OrderStatusChanged", payload, cancellationToken)
      };
      if (clientId.HasValue)
        tasks.Add(_hubContext.Clients.User(clientId.Value.ToString()).SendAsync("OrderStatusChanged", payload, cancellationToken));
      await Task.WhenAll(tasks);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish OrderStatusChanged for order {OrderId}", orderId);
    }
  }

  public async Task PublishBasketUpdatedAsync(
    Guid userId,
    CancellationToken cancellationToken = default)
  {
    try
    {
      await _hubContext.Clients.User(userId.ToString()).SendAsync("BasketUpdated", new { userId }, cancellationToken);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish BasketUpdated for user {UserId}", userId);
    }
  }

  public async Task PublishPrescriptionUpdatedAsync(
    Guid prescriptionId,
    Guid clientId,
    PrescriptionStatus status,
    Guid? assignedPharmacistId,
    CancellationToken cancellationToken = default)
  {
    try
    {
      var payload = new
      {
        prescriptionId,
        clientId,
        status = status.ToString(),
        assignedPharmacistId,
      };
      var tasks = new List<Task>
      {
        _hubContext.Clients.Group(UpdatesHub.PharmacistGroup).SendAsync("PrescriptionUpdated", payload, cancellationToken),
        _hubContext.Clients.Group(UpdatesHub.SuperAdminGroup).SendAsync("PrescriptionUpdated", payload, cancellationToken),
        _hubContext.Clients.User(clientId.ToString()).SendAsync("PrescriptionUpdated", payload, cancellationToken),
      };
      await Task.WhenAll(tasks);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish PrescriptionUpdated for {PrescriptionId}", prescriptionId);
    }
  }

  public async Task PublishManualLookupRequestCreatedAsync(
    Guid requestId,
    Guid prescriptionId,
    Guid requestedByPharmacistId,
    CancellationToken cancellationToken = default)
  {
    try
    {
      var payload = new { requestId, prescriptionId, requestedByPharmacistId };
      await _hubContext.Clients
        .Group(UpdatesHub.AdminGroup)
        .SendAsync("ManualLookupRequestCreated", payload, cancellationToken);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish ManualLookupRequestCreated for {RequestId}", requestId);
    }
  }

  public async Task PublishManualLookupResponseAddedAsync(
    Guid requestId,
    Guid responseId,
    Guid respondingPharmacyId,
    Guid requestedByPharmacistId,
    CancellationToken cancellationToken = default)
  {
    try
    {
      var payload = new { requestId, responseId, respondingPharmacyId };
      // Send to the initiating pharmacist (User-routed) and broadcast to
      // the pharmacist group so the lookup detail panel can refresh
      // regardless of who's looking. Admin group also sees it so an admin
      // re-editing their answer sees the row update.
      var tasks = new List<Task>
      {
        _hubContext.Clients.User(requestedByPharmacistId.ToString())
          .SendAsync("ManualLookupResponseAdded", payload, cancellationToken),
        _hubContext.Clients.Group(UpdatesHub.PharmacistGroup)
          .SendAsync("ManualLookupResponseAdded", payload, cancellationToken),
        _hubContext.Clients.Group(UpdatesHub.AdminGroup)
          .SendAsync("ManualLookupResponseAdded", payload, cancellationToken),
      };
      await Task.WhenAll(tasks);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish ManualLookupResponseAdded for {RequestId}", requestId);
    }
  }

  public async Task PublishManualLookupRequestClosedAsync(
    Guid requestId,
    CancellationToken cancellationToken = default)
  {
    try
    {
      var payload = new { requestId };
      var tasks = new List<Task>
      {
        _hubContext.Clients.Group(UpdatesHub.AdminGroup)
          .SendAsync("ManualLookupRequestClosed", payload, cancellationToken),
        _hubContext.Clients.Group(UpdatesHub.PharmacistGroup)
          .SendAsync("ManualLookupRequestClosed", payload, cancellationToken),
      };
      await Task.WhenAll(tasks);
    }
    catch (Exception ex)
    {
      _logger.LogWarning(ex, "Failed to publish ManualLookupRequestClosed for {RequestId}", requestId);
    }
  }
}
