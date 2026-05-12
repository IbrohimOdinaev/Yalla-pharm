namespace Yalla.Application.DTO.Response;

/// <summary>
/// Pharmacy-coverage breakdown for a decoded prescription. Each option is
/// a pharmacy with the line items it can fulfil — both catalog refs and
/// manual lines that pharmacy responded to via the lookup workflow.
/// </summary>
public sealed class GetPrescriptionPharmacyOptionsResponse
{
    public Guid PrescriptionId { get; set; }
    public IReadOnlyList<PrescriptionPharmacyOptionResponse> PharmacyOptions { get; set; } = [];
}

public sealed class PrescriptionPharmacyOptionResponse
{
    public Guid PharmacyId { get; set; }
    public string PharmacyTitle { get; set; } = string.Empty;
    public bool PharmacyIsActive { get; set; }

    /// <summary>How many of the prescription's orderable line items this
    /// pharmacy can fulfil (catalog hit + manual lookup hit count).</summary>
    public int FoundItemsCount { get; set; }

    public int TotalItemsCount { get; set; }

    /// <summary>Number of items where the pharmacy has enough stock for
    /// the requested quantity.</summary>
    public int EnoughQuantityItemsCount { get; set; }

    /// <summary>True iff the pharmacy is active AND covers every item
    /// with sufficient stock — a one-shot eligibility flag for the UI.</summary>
    public bool IsAvailable { get; set; }

    /// <summary>Total cost summed across found items at this pharmacy.</summary>
    public decimal TotalCost { get; set; }

    public IReadOnlyList<PrescriptionPharmacyItemResponse> Items { get; set; } = [];
}

public sealed class PrescriptionPharmacyItemResponse
{
    public Guid ChecklistItemId { get; set; }

    /// <summary>The medicineId to pass into <c>Source.Positions</c> when
    /// the client checks out at this pharmacy. For catalog items it's
    /// the catalog medicine; for manual items it's the per-pharmacy
    /// shadow medicine that mirrors the lookup response.</summary>
    public Guid? MedicineId { get; set; }

    /// <summary>Pharmacist-recommended quantity (the original
    /// <c>ChecklistItem.Quantity</c>). The client may lower this on the
    /// frontend, but never raise it past the pharmacy's stock.</summary>
    public int RequestedQuantity { get; set; }

    /// <summary>Display title — catalog medicine title for catalog items,
    /// the responding pharmacy's <c>FullName</c> for manual items.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>True iff the pharmacy has the item (catalog offer or
    /// manual lookup response).</summary>
    public bool IsFound { get; set; }

    /// <summary>Stock units available; 0 when not found.</summary>
    public int FoundQuantity { get; set; }

    public bool HasEnoughQuantity { get; set; }

    public decimal? Price { get; set; }

    /// <summary>True for items materialised from a manual prescription
    /// lookup — UI uses this to render the "временное предложение" badge.</summary>
    public bool IsManualLookup { get; set; }

    /// <summary>The pharmacist priced this row "by units" — UI should
    /// render UnitCount/UnitTotalPrice and ignore <see cref="Price"/>×qty.</summary>
    public bool UseUnitMode { get; set; }
    public int? UnitCount { get; set; }
    public decimal? UnitTotalPrice { get; set; }
}
