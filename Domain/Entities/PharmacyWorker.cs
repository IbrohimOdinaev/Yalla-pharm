using Yalla.Domain.Exceptions;
using Yalla.Domain.Enums;

namespace Yalla.Domain.Entities;

public class PharmacyWorker : User
{
    public Guid PharmacyId { get; private set; }
    public Pharmacy? Pharmacy { get; private set; }

    private PharmacyWorker() : base() { }

    public PharmacyWorker(
      string name,
      string phoneNumber,
      string passwordHash,
      Guid pharmacyId,
      Pharmacy? pharmacy)
      : base(Guid.NewGuid(), name, phoneNumber, passwordHash, Role.Admin)
    {
        if (pharmacy is null)
            throw new DomainArgumentException("Pharmacy can't be null.");

        if (pharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        Pharmacy = pharmacy;
        PharmacyId = pharmacyId;
    }

    public PharmacyWorker(
      Guid id,
      string name,
      string phoneNumber,
      string passwordHash,
      Guid pharmacyId,
      Pharmacy? pharmacy,
      Role role)
      : base(id, name, phoneNumber, passwordHash, role)
    {
        if (pharmacy is null)
            throw new DomainArgumentException("Pharmacy can't be null.");

        if (pharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        PharmacyId = pharmacyId;
        Pharmacy = pharmacy;
    }
}
