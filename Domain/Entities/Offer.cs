using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class Offer
{
  public Guid Id { get; private set; }

  public Guid MedicineId { get; private set; }

  public Guid PharmacyId { get; private set; }

  public int StockQuantity { get; private set; } = 0;

  public decimal Price { get; private set; } = 0;


  private Offer() { }

  public Offer(Guid medicineId, Guid pharmacyId, int stockQuantity, decimal price)
  {
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineId can't be empty.");

    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    if (stockQuantity < 0)
      throw new DomainArgumentException("StockQuantity can't be negative.");

    if (price < 0)
      throw new DomainArgumentException("Price can't be negative.");

    Id = Guid.NewGuid();
    MedicineId = medicineId;
    PharmacyId = pharmacyId;
    StockQuantity = stockQuantity;
    Price = price;
  }

  public Offer(Guid id, Guid medicineId, Guid pharmacyId, int stockQuantity, decimal price)
  {
    if (id == Guid.Empty)
      throw new DomainArgumentException("Id can't be empty.");

    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineId can't be empty.");

    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    if (stockQuantity < 0)
      throw new DomainArgumentException("StockQuantity can't be negative.");

    if (price < 0)
      throw new DomainArgumentException("Price can't be negative.");

    Id = id;
    MedicineId = medicineId;
    PharmacyId = pharmacyId;
    StockQuantity = stockQuantity;
    Price = price;
  }


  public void SetStockQuantity(int stockQuantity)
  {
    if (stockQuantity < 0)
      throw new DomainArgumentException("StockQuantity can't be negative.");

    StockQuantity = stockQuantity;
  }

  public void SetPrice(decimal price)
  {
    if (price < 0)
      throw new DomainArgumentException("Price can't be negative.");

    Price = price;
  }
}
