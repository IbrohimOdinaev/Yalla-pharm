using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class PharmacyWorker : User
{
  public Guid PharmacyId { get; private set; }
  public Pharmacy? Pharmacy { get; private set; }


  private PharmacyWorker() : base() { }

  public PharmacyWorker(string name, string phoneNumber, Guid pharmacyId, Pharmacy? pharmacy)
    : base(name, phoneNumber)
  {
    if (pharmacy is null)
      throw new DomainArgumentException("Pharmacy can't be null.");

    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    Pharmacy = pharmacy;
    PharmacyId = pharmacyId;
  }

  public PharmacyWorker(Guid id, string name, string phoneNumber, Guid pharmacyId, Pharmacy? pharmacy)
    : base(name, phoneNumber)
  {
    Id = id;
    PharmacyId = pharmacyId;
    Pharmacy = pharmacy;
  }
}
