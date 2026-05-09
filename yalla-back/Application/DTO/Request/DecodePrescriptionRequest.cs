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

    /// <summary>FK to a <c>ManualItemLookupRequest</c> the pharmacist
    /// already created for this manual line. Lets the pharmacist preserve
    /// the lookup binding when re-submitting the checklist (the request
    /// stays Open so admins can keep responding until the final submit).
    /// Only meaningful when <see cref="MedicineId"/> is null.</summary>
    public Guid? LookupRequestId { get; set; }
}
