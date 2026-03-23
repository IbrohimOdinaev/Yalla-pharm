using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class MedicineImage
{
  public Guid Id { get; private set; }
  public string Key { get; private set; } = string.Empty;
  public bool IsMain { get; private set; }
  public bool IsMinimal { get; private set; }
  public Guid MedicineId { get; private set; }
  public Medicine? Medicine { get; private set; }

  private MedicineImage() { }

  public MedicineImage(Guid medicineId, string key, bool isMain, bool isMinimal)
  {
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineImage.MedicineId can't be empty.");

    if (string.IsNullOrWhiteSpace(key))
      throw new DomainArgumentException("MedicineImage.Key can't be null or whitespace.");

    Id = Guid.NewGuid();
    MedicineId = medicineId;
    Key = key;
    IsMain = isMain;
    IsMinimal = isMinimal;
  }

  public MedicineImage(Guid id, Guid medicineId, string key, bool isMain, bool isMinimal)
  {
    if (id == Guid.Empty)
      throw new DomainArgumentException("MedicineImage.Id can't be empty.");

    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineImage.MedicineId can't be empty.");

    if (string.IsNullOrWhiteSpace(key))
      throw new DomainArgumentException("MedicineImage.Key can't be null or whitespace.");

    Id = id;
    MedicineId = medicineId;
    Key = key;
    IsMain = isMain;
    IsMinimal = isMinimal;
  }
}
