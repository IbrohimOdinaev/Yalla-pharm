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
