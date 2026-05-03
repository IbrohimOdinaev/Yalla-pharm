namespace Yalla.Application.DTO.Response;

public sealed class PrescriptionResponse
{
    public Guid PrescriptionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int PatientAge { get; set; }
    public string? ClientComment { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? DecodedAtUtc { get; set; }
    public string? PharmacistOverallComment { get; set; }
    public Guid? AssignedPharmacistId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? PaymentIntentId { get; set; }
    public List<PrescriptionImageResponse> Images { get; set; } = new();
    public List<PrescriptionChecklistItemResponse> Items { get; set; } = new();
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
    public int Quantity { get; set; }
    public string? PharmacistComment { get; set; }
}
