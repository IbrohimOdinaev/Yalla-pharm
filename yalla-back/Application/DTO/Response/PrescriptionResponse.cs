namespace Yalla.Application.DTO.Response;

public sealed class PrescriptionResponse
{
    public Guid PrescriptionId { get; set; }
    public Guid ClientId { get; set; }
    /// <summary>Client display name (may be empty for OTP/Telegram-only clients without a saved name).</summary>
    public string? ClientName { get; set; }
    /// <summary>Client phone in normalised 9-digit form, or empty for Telegram-only accounts.</summary>
    public string? ClientPhoneNumber { get; set; }
    public long? ClientTelegramId { get; set; }
    public string? ClientTelegramUsername { get; set; }
    public string Status { get; set; } = string.Empty;
    /// <summary>"AsPrescribed", "GoldenMiddle" or "MaxSavings" — the
    /// checklist tier the client picked at submit time.</summary>
    public string PreferenceTier { get; set; } = "AsPrescribed";
    public int PatientAge { get; set; }
    public string? ClientComment { get; set; }
    /// <summary>Callback contacts the client left at submission so the
    /// pharmacist can reach them for clarifications during decoding.</summary>
    public string? ClientContacts { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? DecodedAtUtc { get; set; }
    public string? PharmacistOverallComment { get; set; }
    public Guid? AssignedPharmacistId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? PaymentIntentId { get; set; }
    /// <summary>
    /// External DushanbeCity payment URL the client should follow to pay
    /// the 3 TJS service fee. Filled only by CreatePrescription right
    /// after a fresh submit; subsequent reads (`GET me`, etc.) leave it
    /// null since the URL is meant to be one-shot.
    /// </summary>
    public string? PaymentUrl { get; set; }
    public decimal? PaymentAmount { get; set; }
    public string? PaymentCurrency { get; set; }
    public List<PrescriptionImageResponse> Images { get; set; } = new();
    public List<PrescriptionChecklistItemResponse> Items { get; set; } = new();
    /// <summary>Reason the prescription was cancelled, when applicable.
    /// Serialised as the enum name string ("ClientCancelled", etc.).
    /// Null on any non-Cancelled status and on rows that pre-date the
    /// field.</summary>
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAtUtc { get; set; }

    /// <summary>Reason the pharmacist couldn't decode the prescription.
    /// Set only when status === DecodeFailed.</summary>
    public string? DecodeFailureReason { get; set; }
    public DateTime? DecodeFailedAtUtc { get; set; }
    public string? DecodeFailureComment { get; set; }
}

public sealed class PrescriptionImageResponse
{
    public Guid Id { get; set; }
    public int OrderIndex { get; set; }
    /// <summary>Anonymous content URL; mirrors the medicine-image content endpoint.</summary>
    public string Url { get; set; } = string.Empty;
}

public sealed class PrescriptionChecklistItemResponse
{
    public Guid Id { get; set; }
    public Guid? MedicineId { get; set; }
    public string? ManualMedicineName { get; set; }
    /// <summary>Snapshot of the catalog medicine's title at response build
    /// time, when <see cref="MedicineId"/> is set. Pharmacist history /
    /// admin views render this directly so the row always shows a name
    /// without a follow-up /api/medicines/by-ids round-trip.</summary>
    public string? MedicineTitle { get; set; }
    public int Quantity { get; set; }
    public string? PharmacistComment { get; set; }
    /// <summary>"Original" or "Undecoded".</summary>
    public string Kind { get; set; } = "Original";
    /// <summary>Optional cheaper substitute id from the catalog (legacy
    /// catalog-pick analog flow). Always null for items decoded by the
    /// new pair-from-cart flow — use <see cref="AnalogItemId"/> instead.</summary>
    public Guid? AnalogMedicineId { get; set; }
    /// <summary>Paired-analog reference — points to another item id in
    /// the same checklist when this row is an "original" with a paired
    /// analog. The referenced sibling stays in the response under its
    /// own row; the client renders the pair as one block with the
    /// analog highlighted on top.</summary>
    public Guid? AnalogItemId { get; set; }
    /// <summary>FK to a manual lookup request created for this item, if
    /// the pharmacist asked other pharmacies to physically locate it.
    /// Null for catalog items and for manual items without a lookup.</summary>
    public Guid? LookupRequestId { get; set; }

    /// <summary>Number of pharmacy admins who answered this item's
    /// lookup with a temp offer (= shadow medicines + offers
    /// materialised on submit). Null for catalog items; 0 when nobody
    /// has replied yet so the frontend can still render "ждём ответов".</summary>
    public int? TemporaryOfferCount { get; set; }

    /// <summary>Cheapest price across the temp offers — gives the UI a
    /// "от X TJS" line for manual lookup items the same way catalog
    /// items show their min offer price. Null when nobody responded.</summary>
    public decimal? TemporaryOfferMinPrice { get; set; }

    /// <summary>The pharmacist switched this row into "by units"
    /// pricing — the client should render UnitCount + UnitTotalPrice
    /// instead of the package count + offer-times-quantity total.</summary>
    public bool UseUnitMode { get; set; }
    public int? UnitCount { get; set; }
    public decimal? UnitTotalPrice { get; set; }
}
