using Yalla.Domain.Enums;

namespace Yalla.Domain.Entities;

/// <summary>
/// Pharmacist — global pool worker who decodes client-submitted prescriptions
/// and composes a checklist back. Not bound to any pharmacy (unlike
/// <see cref="PharmacyWorker"/>); created by SuperAdmin.
/// </summary>
public class Pharmacist : User
{
    private Pharmacist() : base() { }

    public Pharmacist(string name, string phoneNumber, string passwordHash)
      : base(Guid.NewGuid(), name, phoneNumber, passwordHash, Role.Pharmacist)
    {
    }

    public Pharmacist(
      Guid id,
      string name,
      string phoneNumber,
      string passwordHash)
      : base(id, name, phoneNumber, passwordHash, Role.Pharmacist)
    {
    }
}
