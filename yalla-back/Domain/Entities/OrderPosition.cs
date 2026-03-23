using Yalla.Domain.Exceptions;
using Yalla.Domain.ValueObjects;

namespace Yalla.Domain.Entities;

public class OrderPosition
{
    public Guid Id { get; private set; }

    public Guid OrderId { get; private set; }

    public Guid MedicineId { get; private set; }

    public Medicine? Medicine { get; private set; }

    public OfferSnapshot OfferSnapshot { get; private set; } = null!;

    public int Quantity { get; private set; }

    public bool IsRejected { get; private set; }

    private OrderPosition() { }

    public OrderPosition(
      Guid orderId,
      Guid medicineId,
      Medicine? medicine,
      OfferSnapshot offerSnapshot,
      int quantity,
      bool isRejected = false)
    {
        if (orderId == Guid.Empty)
            throw new DomainArgumentException("OrderId can't be empty.");

        if (medicineId == Guid.Empty)
            throw new DomainArgumentException("MedicineId can't be empty.");

        if (offerSnapshot is null)
            throw new DomainArgumentException("OfferSnapshot can't be null.");

        if (quantity <= 0)
            throw new DomainArgumentException("Quantity must be greater than zero.");

        Id = Guid.NewGuid();
        OrderId = orderId;
        MedicineId = medicineId;
        Medicine = medicine;
        OfferSnapshot = offerSnapshot;
        Quantity = quantity;
        IsRejected = isRejected;
    }

    public OrderPosition(
      Guid id,
      Guid orderId,
      Guid medicineId,
      Medicine? medicine,
      OfferSnapshot offerSnapshot,
      int quantity,
      bool isRejected = false)
      : this(orderId, medicineId, medicine, offerSnapshot, quantity, isRejected)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("Id can't be empty.");

        Id = id;
    }

    public void AttachMedicine(Medicine? medicine)
    {
        if (medicine is null)
            throw new DomainArgumentException("Medicine can't be null.");

        if (medicine.Id != MedicineId)
            throw new DomainArgumentException("Medicine.Id must match OrderPosition.MedicineId.");

        Medicine = medicine;
    }

    public void Reject()
    {
        IsRejected = true;
    }

    public void Restore()
    {
        IsRejected = false;
    }
}
