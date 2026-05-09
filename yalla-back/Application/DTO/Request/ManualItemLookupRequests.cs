namespace Yalla.Application.DTO.Request;

/// <summary>Pharmacist creates a manual-lookup request for a single
/// out-of-catalog checklist item. Sent from the pharmacist UI when
/// the pharmacist hits "Запросить у других аптек".</summary>
public sealed class CreateManualLookupRequest
{
    public Guid PrescriptionId { get; set; }
    public string ManualMedicineName { get; set; } = string.Empty;
    public string? RequestComment { get; set; }
}

/// <summary>Pharmacy admin upserts their response to a lookup request.
/// Multipart endpoint: the photo (optional) is bound separately by the
/// controller; this DTO carries the form fields.</summary>
public sealed class RespondToManualLookupRequest
{
    public string FullName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public string? ResponseComment { get; set; }
    /// <summary>When true and no new photo is uploaded, the existing
    /// photo (if any) is removed during the upsert.</summary>
    public bool ClearImage { get; set; }
}

/// <summary>Common pagination shape for the admin "history" tab.</summary>
public sealed class GetManualLookupHistoryRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}
