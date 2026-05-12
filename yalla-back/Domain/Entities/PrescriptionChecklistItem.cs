using Yalla.Domain.Enums;
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

    /// <summary>Pharmacist's verdict — defaults to <c>Original</c> for
    /// rows that pre-date the field (legacy behaviour).</summary>
    public PrescriptionChecklistItemKind Kind { get; private set; }
      = PrescriptionChecklistItemKind.Original;

    /// <summary>[Deprecated] Catalog-medicine pointer from the v1 analog
    /// flow (pick a medicine from the catalog as substitute). Kept on the
    /// schema for back-compat; new code uses <see cref="AnalogItemId"/>
    /// which references another checklist item in the same prescription
    /// instead of an arbitrary medicine. Not populated by the new
    /// pair-from-cart flow.</summary>
    public Guid? AnalogMedicineId { get; private set; }

    /// <summary>Cheaper paired item the pharmacist recommends as analog.
    /// Points to another <see cref="PrescriptionChecklistItem"/> in the
    /// SAME prescription. Set on the "original" item of the pair; the
    /// referenced item itself stays unaware (one-way link, walked at
    /// render time). Only meaningful when <see cref="Kind"/> is
    /// <see cref="PrescriptionChecklistItemKind.Original"/>.</summary>
    public Guid? AnalogItemId { get; private set; }

    /// <summary>FK to the <see cref="ManualItemLookupRequest"/> the
    /// pharmacist created for this manual position. Null until the
    /// pharmacist hits "ask other pharmacies"; only ever set on Manual
    /// items (where <see cref="MedicineId"/> is null). All pharmacy
    /// responses on this request become temp-offers (shadow medicines +
    /// offers) when the prescription's checklist is submitted.</summary>
    public Guid? LookupRequestId { get; private set; }

    /// <summary>
    /// "Sell by units" override the pharmacist can switch on per item.
    /// When true the client sees the row as `{UnitCount} штук` with
    /// total = <see cref="UnitTotalPrice"/>; the system still uses
    /// <see cref="Quantity"/> as the package count for stock checks
    /// (it's the pharmacist-supplied minimum N of packages needed to
    /// cover the requested unit count). When false the row behaves as
    /// before: total = Price * Quantity, qty shown as packages.
    /// </summary>
    public bool UseUnitMode { get; private set; }

    /// <summary>Number of single units (tablets/ampoules/...) the
    /// pharmacist asked for. Display value only — has no effect on
    /// stock decrement. Set iff <see cref="UseUnitMode"/>.</summary>
    public int? UnitCount { get; private set; }

    /// <summary>Total price for the line, entered manually by the
    /// pharmacist. Replaces the offer-price-times-quantity calculation
    /// for this row. Set iff <see cref="UseUnitMode"/>.</summary>
    public decimal? UnitTotalPrice { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    private PrescriptionChecklistItem() { }

    private PrescriptionChecklistItem(
      Guid? medicineId,
      string? manualMedicineName,
      int quantity,
      string? pharmacistComment,
      PrescriptionChecklistItemKind kind,
      Guid? analogMedicineId)
    {
        if (quantity <= 0)
            throw new DomainArgumentException(
              "PrescriptionChecklistItem.Quantity must be greater than zero.");

        // Undecoded rows can have neither medicine id nor manual name — they
        // exist purely to flag "couldn't read this line of the prescription".
        if (kind != PrescriptionChecklistItemKind.Undecoded)
        {
            if (medicineId is null && string.IsNullOrWhiteSpace(manualMedicineName))
                throw new DomainArgumentException(
                  "Either MedicineId or ManualMedicineName must be provided.");

            if (medicineId is not null && !string.IsNullOrWhiteSpace(manualMedicineName))
                throw new DomainArgumentException(
                  "MedicineId and ManualMedicineName are mutually exclusive.");
        }

        if (manualMedicineName is { Length: > MaxManualNameLength })
            throw new DomainArgumentException(
              $"ManualMedicineName can't exceed {MaxManualNameLength} characters.");

        if (pharmacistComment is { Length: > MaxPharmacistCommentLength })
            throw new DomainArgumentException(
              $"PharmacistComment can't exceed {MaxPharmacistCommentLength} characters.");

        if (analogMedicineId == Guid.Empty)
            throw new DomainArgumentException("AnalogMedicineId can't be empty.");

        if (analogMedicineId is not null
          && kind == PrescriptionChecklistItemKind.Undecoded)
            throw new DomainArgumentException(
              "Undecoded items cannot carry an analog medicine.");

        if (analogMedicineId is not null
          && analogMedicineId == medicineId)
            throw new DomainArgumentException(
              "AnalogMedicineId must differ from MedicineId.");

        Id = Guid.NewGuid();
        MedicineId = medicineId;
        ManualMedicineName = string.IsNullOrWhiteSpace(manualMedicineName)
          ? null
          : manualMedicineName.Trim();
        Quantity = quantity;
        PharmacistComment = string.IsNullOrWhiteSpace(pharmacistComment)
          ? null
          : pharmacistComment.Trim();
        Kind = kind;
        AnalogMedicineId = analogMedicineId;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public static PrescriptionChecklistItem FromCatalog(
      Guid medicineId,
      int quantity,
      string? pharmacistComment,
      Guid? analogMedicineId = null) =>
        new(
          medicineId == Guid.Empty
            ? throw new DomainArgumentException("MedicineId can't be empty.")
            : medicineId,
          manualMedicineName: null,
          quantity,
          pharmacistComment,
          PrescriptionChecklistItemKind.Original,
          analogMedicineId);

    public static PrescriptionChecklistItem Manual(
      string manualMedicineName,
      int quantity,
      string? pharmacistComment) =>
        new(
          medicineId: null,
          manualMedicineName,
          quantity,
          pharmacistComment,
          PrescriptionChecklistItemKind.Original,
          analogMedicineId: null);

    /// <summary>Pharmacist couldn't read this line of the doctor's note.
    /// Records the position as informational; not orderable.</summary>
    public static PrescriptionChecklistItem Undecoded(
      int quantity,
      string? pharmacistComment) =>
        new(
          medicineId: null,
          manualMedicineName: null,
          quantity,
          pharmacistComment,
          PrescriptionChecklistItemKind.Undecoded,
          analogMedicineId: null);

    public bool IsOutOfCatalog => MedicineId is null
      && Kind != PrescriptionChecklistItemKind.Undecoded;

    public void SetQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new DomainArgumentException(
              "PrescriptionChecklistItem.Quantity must be greater than zero.");

        Quantity = quantity;
    }

    /// <summary>Pair this item with another checklist item as its analog.
    /// Caller must ensure <paramref name="analogItemId"/> belongs to the
    /// same prescription — that's the responsibility of the application
    /// service since the entity has no awareness of its sibling rows.
    /// Re-pairing overwrites; passing <c>null</c> unpairs.</summary>
    public void SetAnalogItem(Guid? analogItemId)
    {
        if (analogItemId == Guid.Empty)
            throw new DomainArgumentException("AnalogItemId can't be empty.");

        if (analogItemId is not null && analogItemId == Id)
            throw new DomainArgumentException(
              "AnalogItemId cannot reference the item itself.");

        if (analogItemId is not null
          && Kind == PrescriptionChecklistItemKind.Undecoded)
            throw new DomainArgumentException(
              "Undecoded items cannot carry an analog reference.");

        AnalogItemId = analogItemId;
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

    /// <summary>
    /// Switch the row into "by units" mode. <paramref name="unitCount"/>
    /// is what the client sees ("30 таблеток"); <paramref name="unitTotalPrice"/>
    /// replaces the auto-calculated line total; the item's own
    /// <see cref="Quantity"/> stays the package count used for stock
    /// verification (set separately on the entity, must be ≥ 1).
    /// Cannot be applied to Undecoded items.
    /// </summary>
    public void SetUnitOverride(int unitCount, decimal unitTotalPrice)
    {
        if (Kind == PrescriptionChecklistItemKind.Undecoded)
            throw new DomainException(
              "Unit-mode override cannot be applied to Undecoded items.");
        if (unitCount <= 0)
            throw new DomainArgumentException("UnitCount must be greater than zero.");
        if (unitTotalPrice <= 0)
            throw new DomainArgumentException("UnitTotalPrice must be greater than zero.");

        UseUnitMode = true;
        UnitCount = unitCount;
        UnitTotalPrice = unitTotalPrice;
    }

    public void ClearUnitOverride()
    {
        UseUnitMode = false;
        UnitCount = null;
        UnitTotalPrice = null;
    }
}
