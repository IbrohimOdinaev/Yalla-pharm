namespace Yalla.Domain.Enums;

/// <summary>
/// Pharmacist's verdict for a single checklist line. Either they identified
/// the original medicine (and may attach an analog substitute from our
/// catalog), or they couldn't read what the doctor wrote at all.
/// </summary>
public enum PrescriptionChecklistItemKind
{
  /// <summary>Pharmacist identified the medicine. <see cref="MedicineId"/>
  /// holds the original; <c>AnalogMedicineId</c> may hold a cheaper
  /// substitute they recommend.</summary>
  Original = 0,

  /// <summary>Pharmacist couldn't decode the doctor's handwriting. Both
  /// medicine ids may be null; the row is informational only and isn't
  /// available for ordering.</summary>
  Undecoded = 1,
}
