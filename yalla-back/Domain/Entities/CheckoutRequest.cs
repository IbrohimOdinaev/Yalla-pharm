using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class CheckoutRequest
{
  public Guid Id { get; private set; }
  public Guid ClientId { get; private set; }
  public string IdempotencyKey { get; private set; } = string.Empty;
  public string RequestHash { get; private set; } = string.Empty;
  public CheckoutRequestStatus Status { get; private set; }
  public Guid? OrderId { get; private set; }
  public string? PaymentTransactionId { get; private set; }
  public string? FailureReason { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }

  private CheckoutRequest()
  {
  }

  public CheckoutRequest(
    Guid clientId,
    string idempotencyKey,
    string requestHash)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");

    if (string.IsNullOrWhiteSpace(idempotencyKey))
      throw new DomainArgumentException("IdempotencyKey can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(requestHash))
      throw new DomainArgumentException("RequestHash can't be null or whitespace.");

    var normalizedKey = idempotencyKey.Trim();
    if (normalizedKey.Length > 128)
      throw new DomainArgumentException("IdempotencyKey length can't exceed 128.");

    var normalizedHash = requestHash.Trim();
    if (normalizedHash.Length > 128)
      throw new DomainArgumentException("RequestHash length can't exceed 128.");

    Id = Guid.NewGuid();
    ClientId = clientId;
    IdempotencyKey = normalizedKey;
    RequestHash = normalizedHash;
    Status = CheckoutRequestStatus.Pending;
    CreatedAtUtc = DateTime.UtcNow;
    UpdatedAtUtc = CreatedAtUtc;
  }

  public void MarkSucceeded(Guid orderId, string? paymentTransactionId)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    if (Status != CheckoutRequestStatus.Pending)
      throw new DomainException($"CheckoutRequest can't be completed from status '{Status}'.");

    Status = CheckoutRequestStatus.Succeeded;
    OrderId = orderId;
    PaymentTransactionId = string.IsNullOrWhiteSpace(paymentTransactionId)
      ? null
      : paymentTransactionId.Trim();
    FailureReason = null;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void MarkFailed(string? failureReason)
  {
    if (Status != CheckoutRequestStatus.Pending)
      throw new DomainException($"CheckoutRequest can't be failed from status '{Status}'.");

    Status = CheckoutRequestStatus.Failed;
    FailureReason = string.IsNullOrWhiteSpace(failureReason)
      ? null
      : failureReason.Trim();
    UpdatedAtUtc = DateTime.UtcNow;
  }
}
