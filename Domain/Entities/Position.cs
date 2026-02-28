using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class Position
{
  public Guid Id { get; private set; }

  public Guid? OrderId { get; private set; } = null;

  public Offer Offer { get; private set; } = null!;

  public Guid MedicineId { get; private set; }

  public Medicine? Medicine { get; private set; }

  public int Quantity { get; private set; }


  private Position() { }

  public Position(Guid? orderId, Offer? offer, Guid medicineId, Medicine? medicine, int quantity)
  {
    if (offer is null)
      throw new DomainArgumentException("Offer can't be null.");

    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineId can't be empty.");

    if (quantity <= 0)
      throw new DomainArgumentException("Quantity must be greater than zero.");

    if (quantity > offer.StockQuantity)
      throw new DomainArgumentException("Quantity can't be greater than Offer.StockQuantity.");

    OrderId = orderId;
    Offer = offer;
    MedicineId = medicineId;
    Medicine = medicine;
    Quantity = quantity;
  }

  public Position(Guid id, Guid? orderId, Offer offer, Guid medicineId, Medicine? medicine, int quantity)
  {
    Id = id;
    Offer = offer;
    OrderId = orderId;
    MedicineId = medicineId;
    Medicine = medicine;
    Quantity = quantity;
  }

  public void AttachOrderId(Guid orderId)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    OrderId = orderId;
  }

  public void AttachMedicine(Medicine? medicine)
  {
    if (medicine is null)
      throw new DomainArgumentException("Medicine can't be null.");

    Medicine = medicine;
  }

  public void SetQuantity(int newQuantity)
  {
    if (newQuantity <= 0)
      throw new DomainArgumentException("Quantity must be greater than zero.");

    if (newQuantity > Offer.StockQuantity)
      throw new DomainArgumentException("Quantity can't be greater than Offer.StockQuantity.");

    Quantity = newQuantity;
  }
}
