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

    /// <summary>Index of the analog item in the same <c>Items</c> list
    /// (0-based). When set, this row is the "original" of a pair and
    /// the referenced sibling row is its analog. The server resolves
    /// indices to <see cref="PrescriptionChecklistItem.Id"/> values
    /// after creation — see
    /// <see cref="Yalla.Application.Services.PrescriptionService.SubmitChecklistAsync"/>
    /// for the second-pass linker. Self-reference and circular pairs
    /// are rejected. Ignored for Undecoded items.</summary>
    public int? AnalogIndex { get; set; }
}
