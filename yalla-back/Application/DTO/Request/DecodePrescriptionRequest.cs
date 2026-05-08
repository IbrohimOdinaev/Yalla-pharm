namespace Yalla.Application.DTO.Request;

/// <summary>
/// Pharmacist-side body for finalising a prescription review:
/// optional overall comment plus the line items (catalog refs +/or
/// manual entries for medicines we don't carry).
/// </summary>
public sealed class DecodePrescriptionRequest
{
    public string? OverallComment { get; set; }
    public List<DecodePrescriptionItem> Items { get; set; } = new();
}

public sealed class DecodePrescriptionItem
{
    /// <summary>FK to existing Medicine; mutually exclusive with ManualMedicineName.</summary>
    public Guid? MedicineId { get; set; }

    /// <summary>Manual entry for medicines that aren't in our catalog.</summary>
    public string? ManualMedicineName { get; set; }

    public int Quantity { get; set; }

    public string? PharmacistComment { get; set; }

    /// <summary>0 = Original (default), 1 = Undecoded.</summary>
    public int Kind { get; set; }

    /// <summary>Optional cheaper substitute the pharmacist recommends —
    /// must reference an existing catalog medicine and differ from
    /// <see cref="MedicineId"/>. Ignored for Undecoded items.</summary>
    public Guid? AnalogMedicineId { get; set; }
}
