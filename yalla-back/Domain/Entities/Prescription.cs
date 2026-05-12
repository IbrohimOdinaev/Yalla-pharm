using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// A doctor's prescription submitted by a client for decoding by a
/// pharmacist. Holds 1-2 photos, the patient's age (required), an optional
/// client comment, and — once decoded — a checklist of medicines composed
/// by the pharmacist.
/// </summary>
public class Prescription
{
    public const int MinImagesPerPrescription = 1;
    public const int MaxImagesPerPrescription = 2;
    public const int MaxClientCommentLength = 1000;
    public const int MaxPharmacistCommentLength = 2000;

    private readonly List<PrescriptionImage> _images = new();
    private readonly List<PrescriptionChecklistItem> _items = new();

    public Guid Id { get; private set; }

    public Guid ClientId { get; private set; }

    /// <summary>Patient's age, in full years. Required at submission time.</summary>
    public int PatientAge { get; private set; }

    /// <summary>Optional free-text comment from the client.</summary>
    public string? ClientComment { get; private set; }

    public PrescriptionStatus Status { get; private set; }

    /// <summary>Client's tier choice — defaults to <c>AsPrescribed</c> for
    /// historical rows that pre-date the field.</summary>
    public PrescriptionPreferenceTier PreferenceTier { get; private set; }
      = PrescriptionPreferenceTier.AsPrescribed;

    /// <summary>Set when a pharmacist takes the prescription into review.</summary>
    public Guid? AssignedPharmacistId { get; private set; }

    /// <summary>Timestamp the pharmacist submitted the decoded checklist.</summary>
    public DateTime? DecodedAtUtc { get; private set; }

    /// <summary>Pharmacist's overall comment shown above the per-item list.</summary>
    public string? PharmacistOverallComment { get; private set; }

    /// <summary>FK to the 3 TJS PaymentIntent for the decoding service.</summary>
    public Guid? PaymentIntentId { get; private set; }

    /// <summary>FK to the Order created when the client converts the checklist.</summary>
    public Guid? OrderId { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    /// <summary>Set when the prescription moves to
    /// <see cref="PrescriptionStatus.Cancelled"/>. Null on every other
    /// status; never overwritten once set so re-cancel attempts can't
    /// rewrite the audit trail.</summary>
    public DateTime? CancelledAtUtc { get; private set; }

    /// <summary>Why the prescription was cancelled. Null for rows that
    /// pre-date the field; new cancellations always set both this and
    /// <see cref="CancelledAtUtc"/>.</summary>
    public PrescriptionCancellationReason? CancellationReason { get; private set; }

    public IReadOnlyCollection<PrescriptionImage> Images => _images.AsReadOnly();

    public IReadOnlyCollection<PrescriptionChecklistItem> Items => _items.AsReadOnly();

    private Prescription() { }

    public Prescription(
      Guid clientId,
      int patientAge,
      string? clientComment,
      IReadOnlyList<PrescriptionImage> images,
      PrescriptionPreferenceTier preferenceTier = PrescriptionPreferenceTier.AsPrescribed)
    {
        if (clientId == Guid.Empty)
            throw new DomainArgumentException("Prescription.ClientId can't be empty.");

        if (patientAge < 0 || patientAge > 150)
            throw new DomainArgumentException(
              "Prescription.PatientAge must be between 0 and 150.");

        if (clientComment is { Length: > MaxClientCommentLength })
            throw new DomainArgumentException(
              $"Prescription.ClientComment can't exceed {MaxClientCommentLength} characters.");

        if (images is null || images.Count < MinImagesPerPrescription)
            throw new DomainArgumentException(
              $"Prescription must contain at least {MinImagesPerPrescription} image.");

        if (images.Count > MaxImagesPerPrescription)
            throw new DomainArgumentException(
              $"Prescription can contain at most {MaxImagesPerPrescription} images.");

        Id = Guid.NewGuid();
        ClientId = clientId;
        PatientAge = patientAge;
        ClientComment = string.IsNullOrWhiteSpace(clientComment) ? null : clientComment.Trim();
        Status = PrescriptionStatus.Submitted;
        PreferenceTier = preferenceTier;
        CreatedAtUtc = DateTime.UtcNow;
        _images.AddRange(images);
    }

    public void AttachPaymentIntent(Guid paymentIntentId)
    {
        if (paymentIntentId == Guid.Empty)
            throw new DomainArgumentException("PaymentIntentId can't be empty.");

        PaymentIntentId = paymentIntentId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MoveToAwaitingConfirmation()
    {
        if (Status != PrescriptionStatus.Submitted)
            throw new DomainException(
              $"Prescription must be in Submitted status to await confirmation; current is {Status}.");

        Status = PrescriptionStatus.AwaitingConfirmation;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MoveToQueue()
    {
        if (Status != PrescriptionStatus.AwaitingConfirmation)
            throw new DomainException(
              $"Prescription must be in AwaitingConfirmation status to move to queue; current is {Status}.");

        Status = PrescriptionStatus.InQueue;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void TakeIntoReview(Guid pharmacistId)
    {
        if (pharmacistId == Guid.Empty)
            throw new DomainArgumentException("PharmacistId can't be empty.");

        if (Status != PrescriptionStatus.InQueue)
            throw new DomainException(
              $"Prescription must be in InQueue status to take into review; current is {Status}.");

        Status = PrescriptionStatus.InReview;
        AssignedPharmacistId = pharmacistId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SubmitChecklist(
      string? overallComment,
      IReadOnlyList<PrescriptionChecklistItem> items)
    {
        if (Status != PrescriptionStatus.InReview)
            throw new DomainException(
              $"Prescription must be in InReview status to submit a checklist; current is {Status}.");

        if (items is null || items.Count == 0)
            throw new DomainArgumentException("Checklist must contain at least one item.");

        if (overallComment is { Length: > MaxPharmacistCommentLength })
            throw new DomainArgumentException(
              $"PharmacistOverallComment can't exceed {MaxPharmacistCommentLength} characters.");

        PharmacistOverallComment = string.IsNullOrWhiteSpace(overallComment)
          ? null
          : overallComment.Trim();
        DecodedAtUtc = DateTime.UtcNow;
        Status = PrescriptionStatus.Decoded;
        UpdatedAtUtc = DateTime.UtcNow;
        _items.Clear();
        _items.AddRange(items);
    }

    public void MarkOrderPlaced(Guid orderId)
    {
        if (orderId == Guid.Empty)
            throw new DomainArgumentException("OrderId can't be empty.");

        if (Status != PrescriptionStatus.Decoded)
            throw new DomainException(
              $"Prescription must be in Decoded status to mark order placed; current is {Status}.");

        OrderId = orderId;
        Status = PrescriptionStatus.OrderPlaced;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkMovedToCart()
    {
        if (Status != PrescriptionStatus.Decoded)
            throw new DomainException(
              $"Prescription must be in Decoded status to mark moved-to-cart; current is {Status}.");

        Status = PrescriptionStatus.MovedToCart;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel()
        => Cancel(PrescriptionCancellationReason.ClientCancelled);

    /// <summary>
    /// Move the prescription into the terminal <c>Cancelled</c> state
    /// with an explicit reason. Idempotent for repeat
    /// <c>PaymentTimeout</c> calls (already-cancelled prescriptions
    /// are left untouched) — the timeout worker can re-fire without
    /// raising; explicit client/pharmacist cancels on a finalised
    /// prescription still throw because they're logic errors at the
    /// caller, not benign double-fires.
    /// </summary>
    public void Cancel(PrescriptionCancellationReason reason)
    {
        if (Status == PrescriptionStatus.Cancelled)
        {
            // PaymentTimeout retry is benign — skip. Other reasons hitting
            // an already-cancelled row are call-site bugs and should fail
            // loud so we notice.
            if (reason == PrescriptionCancellationReason.PaymentTimeout) return;
            throw new DomainException(
              $"Prescription is already cancelled (reason={CancellationReason}).");
        }

        if (Status is PrescriptionStatus.OrderPlaced
                   or PrescriptionStatus.MovedToCart)
            throw new DomainException(
              $"Prescription can't be cancelled from {Status} status.");

        Status = PrescriptionStatus.Cancelled;
        CancellationReason = reason;
        CancelledAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
