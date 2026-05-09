using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// One line in the pharmacist-composed checklist for a Prescription. Either
/// references a real <see cref="Medicine"/> from our catalog (when
/// <see cref="MedicineId"/> is set) or holds a manual free-text entry
/// (<see cref="ManualMedicineName"/>) for medicines we don't carry. Quantity
/// and per-item pharmacist comment are required / optional respectively.
/// </summary>
public class PrescriptionChecklistItem
{
    public const int MaxManualNameLength = 200;
    public const int MaxPharmacistCommentLength = 1000;

    public Guid Id { get; private set; }

    public Guid PrescriptionId { get; private set; }

    /// <summary>FK to <see cref="Medicine"/>; null when the item is out-of-catalog.</summary>
    public Guid? MedicineId { get; private set; }

    /// <summary>Manual medicine name, set only when <see cref="MedicineId"/> is null.</summary>
    public string? ManualMedicineName { get; private set; }

    public int Quantity { get; private set; }

    public string? PharmacistComment { get; private set; }

    /// <summary>FK to the <see cref="ManualItemLookupRequest"/> the
    /// pharmacist created for this manual position. Null until the
    /// pharmacist hits "ask other pharmacies"; only ever set on Manual
    /// items (where <see cref="MedicineId"/> is null). All pharmacy
    /// responses on this request become temp-offers (shadow medicines +
    /// offers) when the prescription's checklist is submitted.</summary>
    public Guid? LookupRequestId { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    private PrescriptionChecklistItem() { }

    private PrescriptionChecklistItem(
      Guid? medicineId,
      string? manualMedicineName,
      int quantity,
      string? pharmacistComment)
    {
        if (quantity <= 0)
            throw new DomainArgumentException(
              "PrescriptionChecklistItem.Quantity must be greater than zero.");

        if (medicineId is null && string.IsNullOrWhiteSpace(manualMedicineName))
            throw new DomainArgumentException(
              "Either MedicineId or ManualMedicineName must be provided.");

        if (medicineId is not null && !string.IsNullOrWhiteSpace(manualMedicineName))
            throw new DomainArgumentException(
              "MedicineId and ManualMedicineName are mutually exclusive.");

        if (manualMedicineName is { Length: > MaxManualNameLength })
            throw new DomainArgumentException(
              $"ManualMedicineName can't exceed {MaxManualNameLength} characters.");

        if (pharmacistComment is { Length: > MaxPharmacistCommentLength })
            throw new DomainArgumentException(
              $"PharmacistComment can't exceed {MaxPharmacistCommentLength} characters.");

        Id = Guid.NewGuid();
        MedicineId = medicineId;
        ManualMedicineName = string.IsNullOrWhiteSpace(manualMedicineName)
          ? null
          : manualMedicineName.Trim();
        Quantity = quantity;
        PharmacistComment = string.IsNullOrWhiteSpace(pharmacistComment)
          ? null
          : pharmacistComment.Trim();
        CreatedAtUtc = DateTime.UtcNow;
    }

    public static PrescriptionChecklistItem FromCatalog(
      Guid medicineId,
      int quantity,
      string? pharmacistComment) =>
        new(
          medicineId == Guid.Empty
            ? throw new DomainArgumentException("MedicineId can't be empty.")
            : medicineId,
          manualMedicineName: null,
          quantity,
          pharmacistComment);

    public static PrescriptionChecklistItem Manual(
      string manualMedicineName,
      int quantity,
      string? pharmacistComment) =>
        new(
          medicineId: null,
          manualMedicineName,
          quantity,
          pharmacistComment);

    public bool IsOutOfCatalog => MedicineId is null;

    public void SetQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new DomainArgumentException(
              "PrescriptionChecklistItem.Quantity must be greater than zero.");

        Quantity = quantity;
    }

    /// <summary>Attach a lookup request to this item. Only valid on Manual
    /// (out-of-catalog) items — catalog items can't have a lookup since
    /// we already have the medicine. Replacing an existing attachment is
    /// a no-op for the new id, allowing idempotent retries from the
    /// pharmacist UI.</summary>
    public void AttachLookupRequest(Guid lookupRequestId)
    {
        if (lookupRequestId == Guid.Empty)
            throw new DomainArgumentException("LookupRequestId can't be empty.");

        if (MedicineId is not null)
            throw new DomainException(
              "LookupRequest can only be attached to manual (out-of-catalog) items.");

        LookupRequestId = lookupRequestId;
    }

    public void DetachLookupRequest()
    {
        LookupRequestId = null;
    }
}
