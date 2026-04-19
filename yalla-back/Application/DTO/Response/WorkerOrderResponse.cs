using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class WorkerOrderResponse
{
  public Guid OrderId { get; init; }
  public Guid? ClientId { get; init; }
  public string ClientPhoneNumber { get; init; } = string.Empty;
  public Guid PharmacyId { get; init; }
  public DateTime OrderPlacedAt { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public Status Status { get; init; }
  public OrderPaymentState PaymentState { get; init; }
  public DateTime? PaymentExpiresAtUtc { get; init; }
  public decimal Cost { get; init; }
  public decimal ReturnCost { get; init; }
  public decimal DeliveryCost { get; init; }
  public double? DeliveryDistance { get; init; }
  public decimal TotalCost { get; init; }
  public long? JuraOrderId { get; init; }
  public string? JuraStatus { get; init; }
  public int? JuraStatusId { get; init; }
  public string? DriverName { get; init; }
  public string? DriverPhone { get; init; }
  public double? FromLatitude { get; init; }
  public double? FromLongitude { get; init; }
  public double? ToLatitude { get; init; }
  public double? ToLongitude { get; init; }
  public string? Comment { get; init; }
  public IReadOnlyCollection<WorkerOrderPositionResponse> Positions { get; init; } = [];
}
