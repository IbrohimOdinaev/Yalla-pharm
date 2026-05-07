namespace Yalla.Domain.Enums;

/// <summary>
/// How the client wants the pharmacist to compose the checklist for their
/// prescription. Picked once at submission time and surfaced to the
/// pharmacist; the pharmacist still fills in original + analog medicines
/// per item, but this hint tells them which side to favour.
/// </summary>
public enum PrescriptionPreferenceTier
{
  /// <summary>Stick to exactly what the doctor wrote — no substitutes.</summary>
  AsPrescribed = 0,

  /// <summary>Balanced choice — pharmacist's recommended trade-off between
  /// the original brand and a cheaper analog.</summary>
  GoldenMiddle = 1,

  /// <summary>Cheapest available equivalent for every item.</summary>
  MaxSavings = 2,
}
