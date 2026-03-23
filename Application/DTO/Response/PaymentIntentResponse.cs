using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class PaymentIntentResponse
{
  public Guid Id { get; init; }
  public Guid ReservedOrderId { get; init; }
  public Guid ClientId { get; init; }
  public string ClientPhoneNumber { get; init; } = string.Empty;
  public Guid PharmacyId { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public decimal Amount { get; init; }
  public string Currency { get; init; } = string.Empty;
  public string PaymentProvider { get; init; } = string.Empty;
  public string PaymentReceiverAccount { get; init; } = string.Empty;
  public string? PaymentUrl { get; init; }
  public string? PaymentComment { get; init; }
  public PaymentIntentState State { get; init; }
  public string IdempotencyKey { get; init; } = string.Empty;
  public DateTime CreatedAtUtc { get; init; }
  public DateTime UpdatedAtUtc { get; init; }
  public DateTime? ConfirmedAtUtc { get; init; }
  public Guid? ConfirmedByUserId { get; init; }
  public string? RejectReason { get; init; }
  public IReadOnlyCollection<PaymentIntentPositionResponse> Positions { get; init; } = [];
}
