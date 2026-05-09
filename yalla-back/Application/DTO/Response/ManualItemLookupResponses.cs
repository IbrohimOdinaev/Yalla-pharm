namespace Yalla.Application.DTO.Response;

public sealed class ManualLookupResponseResponse
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public Guid RespondingPharmacyId { get; set; }
    public string? RespondingPharmacyTitle { get; set; }
    public Guid RespondingAdminId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    /// <summary>Anonymous content URL (`/api/manual-lookups/responses/{id}/image`)
    /// when an image is attached, otherwise null.</summary>
    public string? ImageUrl { get; set; }
    public string? ResponseComment { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class ManualLookupRequestResponse
{
    public Guid Id { get; set; }
    public Guid PrescriptionId { get; set; }
    public Guid ChecklistItemId { get; set; }
    public Guid RequestedByPharmacistId { get; set; }
    public string? RequestedByPharmacistName { get; set; }
    public string ManualMedicineName { get; set; } = string.Empty;
    public string? RequestComment { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public IReadOnlyList<ManualLookupResponseResponse> Responses { get; set; } = [];
}

public sealed class GetManualLookupHistoryResponse
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public IReadOnlyList<ManualLookupRequestResponse> Requests { get; set; } = [];
}
