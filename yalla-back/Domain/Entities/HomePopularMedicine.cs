namespace Yalla.Domain.Entities;

public sealed class HomePopularMedicine
{
  private HomePopularMedicine() { }

  public HomePopularMedicine(Guid medicineId, int position)
  {
    if (medicineId == Guid.Empty)
      throw new ArgumentException("MedicineId can't be empty.", nameof(medicineId));

    if (position < 1)
      throw new ArgumentOutOfRangeException(nameof(position), "Position must be positive.");

    Id = Guid.NewGuid();
    MedicineId = medicineId;
    Position = position;
    CreatedAtUtc = DateTime.UtcNow;
  }

  public Guid Id { get; private set; }
  public Guid MedicineId { get; private set; }
  public int Position { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }

  public Medicine? Medicine { get; private set; }
}
