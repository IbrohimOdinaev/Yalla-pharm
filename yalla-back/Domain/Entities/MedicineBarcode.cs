using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class MedicineBarcode
{
  public Guid Id { get; private set; }
  public Guid MedicineId { get; private set; }
  public string Barcode { get; private set; } = string.Empty;
  public bool IsVerified { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime LastSeenAtUtc { get; private set; }

  private MedicineBarcode() { }

  public MedicineBarcode(Guid medicineId, string barcode, bool isVerified, DateTime nowUtc)
  {
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineBarcode.MedicineId can't be empty.");

    if (string.IsNullOrWhiteSpace(barcode))
      throw new DomainArgumentException("MedicineBarcode.Barcode can't be null or whitespace.");

    Id = Guid.NewGuid();
    MedicineId = medicineId;
    Barcode = barcode.Trim();
    IsVerified = isVerified;
    CreatedAtUtc = nowUtc;
    LastSeenAtUtc = nowUtc;
  }

  public void MarkSeen(DateTime nowUtc)
  {
    LastSeenAtUtc = nowUtc;
  }

  public void SetVerified(bool isVerified)
  {
    IsVerified = isVerified;
  }
}
