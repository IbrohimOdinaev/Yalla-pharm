using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class StaffCompensationEarning
{
  public Guid Id { get; private set; }
  public Guid StaffUserId { get; private set; }
  public Role StaffRole { get; private set; }
  public StaffCompensationSourceType SourceType { get; private set; }
  public Guid SourceId { get; private set; }
  public Guid? PharmacyId { get; private set; }
  public decimal UnitRate { get; private set; }
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = "TJS";
  public DateTime CreatedAtUtc { get; private set; }

  private StaffCompensationEarning() { }

  public StaffCompensationEarning(
    Guid staffUserId,
    Role staffRole,
    StaffCompensationSourceType sourceType,
    Guid sourceId,
    decimal unitRate,
    string currency = "TJS",
    Guid? pharmacyId = null)
  {
    if (staffUserId == Guid.Empty)
      throw new DomainArgumentException("StaffUserId can't be empty.");
    if (sourceId == Guid.Empty)
      throw new DomainArgumentException("SourceId can't be empty.");
    if (staffRole is not Role.Admin and not Role.Pharmacist)
      throw new DomainArgumentException("Staff compensation is only supported for Admin and Pharmacist roles.");
    if (unitRate < 0)
      throw new DomainArgumentException("UnitRate can't be negative.");
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    Id = Guid.NewGuid();
    StaffUserId = staffUserId;
    StaffRole = staffRole;
    SourceType = sourceType;
    SourceId = sourceId;
    PharmacyId = pharmacyId;
    UnitRate = decimal.Round(unitRate, 2, MidpointRounding.AwayFromZero);
    Amount = UnitRate;
    Currency = NormalizeCurrency(currency);
    CreatedAtUtc = DateTime.UtcNow;
  }

  private static string NormalizeCurrency(string currency)
  {
    var normalized = string.IsNullOrWhiteSpace(currency) ? "TJS" : currency.Trim().ToUpperInvariant();
    if (normalized.Length is < 3 or > 8)
      throw new DomainArgumentException("Currency must be between 3 and 8 characters.");
    return normalized;
  }
}
