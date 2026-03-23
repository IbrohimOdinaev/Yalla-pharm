using Yalla.Domain.Exceptions;

namespace Yalla.Domain.ValueObjects;

public sealed record OfferSnapshot
{
  public Guid PharmacyId { get; }

  public decimal Price { get; }

  public OfferSnapshot(Guid pharmacyId, decimal price)
  {
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("OfferSnapshot.PharmacyId can't be empty.");

    if (price < 0)
      throw new DomainArgumentException("OfferSnapshot.Price can't be negative.");

    PharmacyId = pharmacyId;
    Price = price;
  }
}
