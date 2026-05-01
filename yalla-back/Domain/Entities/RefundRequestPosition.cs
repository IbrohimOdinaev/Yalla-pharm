using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// One line in a <see cref="RefundRequest"/>: which order position is being refunded,
/// how many units, at what unit price, and the resulting line total. Snapshots the
/// medicine name at refund time so the listing stays readable even if the medicine
/// is renamed or soft-deleted later.
/// </summary>
public sealed class RefundRequestPosition
{
  public Guid Id { get; private set; }
  public Guid RefundRequestId { get; private set; }
  public Guid OrderPositionId { get; private set; }
  public Guid MedicineId { get; private set; }
  /// <summary>Snapshot of medicine title at refund creation (for stable listings).</summary>
  public string MedicineName { get; private set; } = string.Empty;
  public int Quantity { get; private set; }
  public decimal UnitPrice { get; private set; }
  public decimal LineTotal { get; private set; }

  private RefundRequestPosition() { }

  public RefundRequestPosition(
    Guid orderPositionId,
    Guid medicineId,
    string medicineName,
    int quantity,
    decimal unitPrice)
  {
    if (orderPositionId == Guid.Empty)
      throw new DomainArgumentException("OrderPositionId can't be empty.");
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineId can't be empty.");
    if (quantity <= 0)
      throw new DomainArgumentException("Quantity must be greater than zero.");
    if (unitPrice < 0)
      throw new DomainArgumentException("UnitPrice can't be negative.");

    Id = Guid.NewGuid();
    OrderPositionId = orderPositionId;
    MedicineId = medicineId;
    MedicineName = NormalizeName(medicineName);
    Quantity = quantity;
    UnitPrice = unitPrice;
    LineTotal = unitPrice * quantity;
  }

  internal void AttachToRefundRequest(Guid refundRequestId)
  {
    if (refundRequestId == Guid.Empty)
      throw new DomainArgumentException("RefundRequestId can't be empty.");
    RefundRequestId = refundRequestId;
  }

  private static string NormalizeName(string medicineName)
  {
    if (string.IsNullOrWhiteSpace(medicineName))
      return "—";
    var trimmed = medicineName.Trim();
    return trimmed.Length > 256 ? trimmed[..256] : trimmed;
  }
}
