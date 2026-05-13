using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// A pharmacist's request to all pharmacies' admins to physically locate a
/// medicine that isn't in our catalog. Created from a <see cref="Prescription"/>
/// in <c>InReview</c> status, against a single <see cref="PrescriptionChecklistItem"/>
/// of <c>Manual</c> kind. All pharmacy admins see Open requests and can
/// respond with their findings; the request closes when the pharmacist
/// submits the checklist (Prescription InReview → Decoded) or when the
/// prescription itself is cancelled.
/// </summary>
public class ManualItemLookupRequest
{
    public const int MaxRequestCommentLength = 1000;

    private readonly List<ManualItemLookupResponse> _responses = new();

    public Guid Id { get; private set; }

    public Guid PrescriptionId { get; private set; }

    public Guid RequestedByPharmacistId { get; private set; }

    /// <summary>Verbatim manual name the pharmacist entered for this item
    /// (mirrors <see cref="PrescriptionChecklistItem.ManualMedicineName"/>
    /// at request time — kept here so admins don't need to load the
    /// prescription to know what they're searching for).</summary>
    public string ManualMedicineName { get; private set; } = string.Empty;

    /// <summary>Optional free-text hint from the pharmacist (dose, form,
    /// etc.) — separate from the per-item pharmacist comment.</summary>
    public string? RequestComment { get; private set; }

    public ManualItemLookupRequestStatus Status { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? ClosedAtUtc { get; private set; }

    public IReadOnlyCollection<ManualItemLookupResponse> Responses => _responses.AsReadOnly();

    private ManualItemLookupRequest() { }

    public ManualItemLookupRequest(
      Guid prescriptionId,
      Guid requestedByPharmacistId,
      string manualMedicineName,
      string? requestComment)
    {
        if (prescriptionId == Guid.Empty)
            throw new DomainArgumentException("PrescriptionId can't be empty.");
        if (requestedByPharmacistId == Guid.Empty)
            throw new DomainArgumentException("RequestedByPharmacistId can't be empty.");

        Id = Guid.NewGuid();
        PrescriptionId = prescriptionId;
        RequestedByPharmacistId = requestedByPharmacistId;
        ManualMedicineName = NormalizeRequiredString(
          manualMedicineName,
          PrescriptionChecklistItem.MaxManualNameLength,
          nameof(ManualMedicineName));
        RequestComment = NormalizeOptionalString(
          requestComment,
          MaxRequestCommentLength,
          nameof(RequestComment));
        Status = ManualItemLookupRequestStatus.Open;
        CreatedAtUtc = DateTime.UtcNow;
        ClosedAtUtc = null;
    }

    /// <summary>
    /// Upsert a pharmacy's response. If the same pharmacy has already
    /// responded, their previous row is updated in place (price/qty/photo
    /// can change as they re-check). Returns the resulting response
    /// (existing or new) so the caller can publish it via SignalR.
    /// </summary>
    public ManualItemLookupResponse AddOrUpdateResponse(
      Guid respondingPharmacyId,
      Guid respondingAdminId,
      string fullName,
      decimal price,
      int quantity,
      string? imageKey,
      string? responseComment)
    {
        if (Status != ManualItemLookupRequestStatus.Open)
            throw new DomainException(
              $"Lookup request must be Open to accept responses; current status is {Status}.");

        var nowUtc = DateTime.UtcNow;
        var existing = _responses.FirstOrDefault(r => r.RespondingPharmacyId == respondingPharmacyId);
        if (existing is not null)
        {
            existing.Update(respondingAdminId, fullName, price, quantity, imageKey, responseComment, nowUtc);
            return existing;
        }

        var response = new ManualItemLookupResponse(
          Id,
          respondingPharmacyId,
          respondingAdminId,
          fullName,
          price,
          quantity,
          imageKey,
          responseComment,
          nowUtc);
        _responses.Add(response);
        return response;
    }

    /// <summary>Close the request — flips status to <c>Closed</c> and stamps
    /// the close time. Idempotent: closing an already-closed request is a
    /// no-op (so callers in the prescription submit path don't have to
    /// guard against races).</summary>
    public void Close()
    {
        if (Status == ManualItemLookupRequestStatus.Closed)
            return;

        Status = ManualItemLookupRequestStatus.Closed;
        ClosedAtUtc = DateTime.UtcNow;
    }

    private static string NormalizeRequiredString(string value, int maxLength, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainArgumentException($"{fieldName} can't be null or whitespace.");

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
            throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

        return normalized;
    }

    private static string? NormalizeOptionalString(string? value, int maxLength, string fieldName)
    {
        if (value is null) return null;
        var normalized = value.Trim();
        if (normalized.Length == 0) return null;
        if (normalized.Length > maxLength)
            throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");
        return normalized;
    }
}
