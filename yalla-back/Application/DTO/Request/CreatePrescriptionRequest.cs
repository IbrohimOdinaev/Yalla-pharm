namespace Yalla.Application.DTO.Request;

/// <summary>
/// Form fields for the multipart prescription-upload endpoint. The photos
/// themselves arrive as a separate <c>IFormFile[]</c> bound by the
/// controller, not on this DTO.
/// </summary>
public sealed class CreatePrescriptionRequest
{
    public int PatientAge { get; set; }
    public string? ClientComment { get; set; }
    /// <summary>0 = AsPrescribed (default), 1 = GoldenMiddle, 2 = MaxSavings.</summary>
    public int PreferenceTier { get; set; }
}
