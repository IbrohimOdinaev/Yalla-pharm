using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class RefundRequest
{
  public Guid Id { get; private set; }
  public Guid? OrderId { get; private set; }
  public Guid ClientId { get; private set; }
  public Guid PharmacyId { get; private set; }
  public string? PaymentTransactionId { get; private set; }
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = string.Empty;
  public string Reason { get; private set; } = string.Empty;
  public RefundRequestStatus Status { get; private set; }
  /// <summary>
  /// Whether the refund involves a physical product return (customer received the goods and is sending them back),
  /// or is a money-only refund (cancel before delivery / position rejection / JURA-cancelled delivery).
  /// </summary>
  public RefundType Type { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }

  private readonly List<RefundRequestPosition> _positions = new();
  public IReadOnlyCollection<RefundRequestPosition> Positions => _positions.AsReadOnly();

  private RefundRequest()
  {
  }

  public RefundRequest(
    Guid? orderId,
    Guid clientId,
    Guid pharmacyId,
    decimal amount,
    string currency,
    string? paymentTransactionId,
    string reason,
    RefundType type = RefundType.WithoutProductReturn,
    IEnumerable<RefundRequestPosition>? positions = null)
  {
    if (orderId.HasValue && orderId.Value == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");

    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    if (amount <= 0)
      throw new DomainArgumentException("Amount must be greater than zero.");

    if (string.IsNullOrWhiteSpace(currency))
      throw new DomainArgumentException("Currency can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(reason))
      throw new DomainArgumentException("Reason can't be null or whitespace.");

    var normalizedCurrency = currency.Trim();
    if (normalizedCurrency.Length > 8)
      throw new DomainArgumentException("Currency length can't exceed 8.");

    var normalizedReason = reason.Trim();
    if (normalizedReason.Length > 1024)
      throw new DomainArgumentException("Reason length can't exceed 1024.");

    if (!string.IsNullOrWhiteSpace(paymentTransactionId) && paymentTransactionId.Trim().Length > 128)
      throw new DomainArgumentException("PaymentTransactionId length can't exceed 128.");

    Id = Guid.NewGuid();
    OrderId = orderId;
    ClientId = clientId;
    PharmacyId = pharmacyId;
    Amount = amount;
    Currency = normalizedCurrency;
    PaymentTransactionId = string.IsNullOrWhiteSpace(paymentTransactionId)
      ? null
      : paymentTransactionId.Trim();
    Reason = normalizedReason;
    Status = RefundRequestStatus.Created;
    Type = type;
    CreatedAtUtc = DateTime.UtcNow;
    UpdatedAtUtc = CreatedAtUtc;

    if (positions is not null)
    {
      foreach (var position in positions)
      {
        AddPosition(position);
      }
    }
  }

  public void AddPosition(RefundRequestPosition position)
  {
    ArgumentNullException.ThrowIfNull(position);
    position.AttachToRefundRequest(Id);
    _positions.Add(position);
  }

  public void MarkInitiatedBySuperAdmin()
  {
    if (Status != RefundRequestStatus.Created)
      throw new DomainException(
        $"RefundRequest can't be initiated from status '{Status}'.");

    Status = RefundRequestStatus.InitiatedBySuperAdmin;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  /// <summary>
  /// Mark the refund as fully refunded to the customer. Allowed from <see cref="RefundRequestStatus.Created"/>
  /// or <see cref="RefundRequestStatus.InitiatedBySuperAdmin"/> — both represent in-progress money-back states.
  /// Idempotent on <see cref="RefundRequestStatus.Completed"/>; rejects from <see cref="RefundRequestStatus.Rejected"/>.
  /// </summary>
  public void MarkCompleted()
  {
    if (Status == RefundRequestStatus.Completed)
      return;

    if (Status == RefundRequestStatus.Rejected)
      throw new DomainException("Rejected refund can't be marked as completed.");

    Status = RefundRequestStatus.Completed;
    UpdatedAtUtc = DateTime.UtcNow;
  }
}
