using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class RefundRequestResponse
{
  public Guid RefundRequestId { get; init; }
  public Guid? OrderId { get; init; }
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public string? PaymentTransactionId { get; init; }
  public decimal Amount { get; init; }
  public string Currency { get; init; } = string.Empty;
  public string Reason { get; init; } = string.Empty;
  public RefundRequestStatus Status { get; init; }
  public DateTime CreatedAtUtc { get; init; }
  public DateTime UpdatedAtUtc { get; init; }
}
