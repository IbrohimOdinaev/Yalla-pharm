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

    /// <summary>Optional cheaper substitute the pharmacist recommends for
    /// this position. Only meaningful when <see cref="Kind"/> is
    /// <see cref="PrescriptionChecklistItemKind.Original"/>.</summary>
    public Guid? AnalogMedicineId { get; private set; }

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
}
