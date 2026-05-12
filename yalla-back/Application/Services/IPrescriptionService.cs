using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPrescriptionService
{
    Task<PrescriptionResponse> CreatePrescriptionAsync(
      Guid clientId,
      CreatePrescriptionRequest request,
      IReadOnlyList<PrescriptionImageUpload> images,
      CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PrescriptionResponse>> GetMyPrescriptionsAsync(
      Guid clientId,
      CancellationToken cancellationToken = default);

    /// <summary>
    /// Client clicks "Я оплатил" after returning from the DC payment page.
    /// Transitions Submitted → AwaitingConfirmation so SuperAdmin can verify
    /// the 3 TJS landed in the bank.
    /// </summary>
    Task<PrescriptionResponse> MarkPaidByClientAsync(
      Guid clientId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default);

    /// <summary>SuperAdmin queue: prescriptions waiting for the 3 TJS payment confirm.</summary>
    Task<IReadOnlyList<PrescriptionResponse>> GetAwaitingConfirmationAsync(
      CancellationToken cancellationToken = default);

    /// <summary>SuperAdmin sign-off: AwaitingConfirmation → InQueue.</summary>
    Task<PrescriptionResponse> ConfirmPaymentAsync(
      Guid prescriptionId,
      CancellationToken cancellationToken = default);

    /// <summary>Pharmacist queue: every prescription in InQueue.</summary>
    Task<IReadOnlyList<PrescriptionResponse>> GetPharmacistQueueAsync(
      CancellationToken cancellationToken = default);

    /// <summary>InQueue + my InReview + my Decoded — fuels the active-prescription picker.</summary>
    Task<IReadOnlyList<PrescriptionResponse>> GetPharmacistAllAsync(
      Guid pharmacistId,
      CancellationToken cancellationToken = default);

    /// <summary>Detail for the pharmacist — must be InQueue, or InReview/Decoded already assigned to them.</summary>
    Task<PrescriptionResponse> GetForPharmacistAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default);

    /// <summary>Pharmacist takes a request into review: InQueue → InReview, assigns themselves.</summary>
    Task<PrescriptionResponse> TakeIntoReviewAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default);

    /// <summary>Pharmacist submits the decoded checklist: InReview → Decoded.</summary>
    Task<PrescriptionResponse> SubmitChecklistAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      DecodePrescriptionRequest request,
      CancellationToken cancellationToken = default);

    /// <summary>
    /// Pharmacist's "I can't decode this" exit. Moves the prescription
    /// to <see cref="Yalla.Domain.Enums.PrescriptionStatus.DecodeFailed"/>
    /// and triggers the side-effect dictated by the reason:
    /// PoorImageQuality grants the client a free credit; IllegibleHandwriting
    /// creates a PendingRefund row for SuperAdmin to settle physically.
    /// </summary>
    Task<PrescriptionResponse> MarkDecodeFailedAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      MarkDecodeFailedRequest request,
      CancellationToken cancellationToken = default);

    /// <summary>
    /// Client pushes the in-catalog checklist items into their regular
    /// basket and moves the prescription into MovedToCart. Out-of-catalog
    /// (manual) items and inactive medicines are skipped.
    /// </summary>
    Task<MoveChecklistToCartResponse> MoveChecklistToCartAsync(
      Guid clientId,
      Guid prescriptionId,
      IReadOnlyDictionary<Guid, int>? quantityOverrides,
      IReadOnlyDictionary<Guid, Guid>? pairSelections,
      CancellationToken cancellationToken = default);

    /// <summary>
    /// Clones a Cancelled prescription as a fresh Submitted one with the same
    /// photos, age and comment. Issues a new payment URL so the client can pay
    /// again — the original cancelled record is left intact for history.
    /// </summary>
    Task<PrescriptionResponse> ResubmitPrescriptionAsync(
      Guid clientId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default);

    /// <summary>
    /// Pharmacy-coverage breakdown for a decoded prescription. Catalog
    /// items resolve through normal offers; manual items resolve through
    /// shadow medicines materialised from each pharmacy's lookup
    /// response. Each option carries a per-line item with the
    /// pharmacy-specific shadow medicineId so the client can pass the
    /// right id into the explicit-source checkout.
    /// </summary>
    Task<GetPrescriptionPharmacyOptionsResponse> GetPharmacyOptionsAsync(
      Guid clientId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default);
}

public sealed class MoveChecklistToCartResponse
{
    public PrescriptionResponse Prescription { get; set; } = new();
    public int MovedItemsCount { get; set; }
    public int SkippedItemsCount { get; set; }
}

/// <summary>
/// One photo a client just uploaded to attach to a fresh prescription.
/// </summary>
public sealed class PrescriptionImageUpload
{
    public required Stream Content { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public required long Length { get; init; }
}
