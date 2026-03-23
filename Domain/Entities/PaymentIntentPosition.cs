using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class PaymentIntentPosition
{
  public Guid Id { get; private set; }
  public Guid PaymentIntentId { get; private set; }
  public Guid MedicineId { get; private set; }
  public Guid OfferPharmacyId { get; private set; }
  public decimal OfferPrice { get; private set; }
  public int Quantity { get; private set; }

  private PaymentIntentPosition()
  {
  }

  public PaymentIntentPosition(
    Guid medicineId,
    Guid offerPharmacyId,
    decimal offerPrice,
    int quantity)
  {
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("MedicineId can't be empty.");

    if (offerPharmacyId == Guid.Empty)
      throw new DomainArgumentException("OfferPharmacyId can't be empty.");

    if (offerPrice <= 0m)
      throw new DomainArgumentException("OfferPrice must be greater than zero.");

    if (quantity <= 0)
      throw new DomainArgumentException("Quantity must be greater than zero.");

    Id = Guid.NewGuid();
    PaymentIntentId = Guid.Empty;
    MedicineId = medicineId;
    OfferPharmacyId = offerPharmacyId;
    OfferPrice = offerPrice;
    Quantity = quantity;
  }

  public PaymentIntentPosition AttachToPaymentIntent(Guid paymentIntentId)
  {
    if (paymentIntentId == Guid.Empty)
      throw new DomainArgumentException("PaymentIntentId can't be empty.");

    if (PaymentIntentId != Guid.Empty && PaymentIntentId != paymentIntentId)
      throw new DomainException("PaymentIntentPosition already attached to another PaymentIntent.");

    PaymentIntentId = paymentIntentId;
    return this;
  }
}
