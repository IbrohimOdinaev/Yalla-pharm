using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// A single pharmacy's response to a <see cref="ManualItemLookupRequest"/>.
/// Holds the price/quantity/full-name the responding pharmacy admin entered
/// after physically locating the medicine in their pharmacy. At most one
/// response per pharmacy per request — re-submitting from the same pharmacy
/// updates the existing row in place via
/// <see cref="ManualItemLookupRequest.AddOrUpdateResponse"/>.
/// </summary>
public class ManualItemLookupResponse
{
    public const int MaxFullNameLength = 256;
    public const int MaxResponseCommentLength = 1000;

    public Guid Id { get; private set; }

    public Guid RequestId { get; private set; }

    /// <summary>FK to the pharmacy whose admin is responding.</summary>
    public Guid RespondingPharmacyId { get; private set; }

    /// <summary>FK to the PharmacyWorker (Admin role) who submitted.</summary>
    public Guid RespondingAdminId { get; private set; }

    /// <summary>Full medicine name as physically read from the box / shelf
    /// label by the responding pharmacy. May refine the original
    /// <see cref="ManualItemLookupRequest.ManualMedicineName"/>.</summary>
    public string FullName { get; private set; } = string.Empty;

    public decimal Price { get; private set; }

    /// <summary>Number of units physically found in stock at the responding
    /// pharmacy. Acts as the upper bound on what the client can order.</summary>
    public int Quantity { get; private set; }

    /// <summary>Optional MinIO key for an attached photo proving the find.</summary>
    public string? ImageKey { get; private set; }

    public string? ResponseComment { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; }

    private ManualItemLookupResponse() { }

    internal ManualItemLookupResponse(
      Guid requestId,
      Guid respondingPharmacyId,
      Guid respondingAdminId,
      string fullName,
      decimal price,
      int quantity,
      string? imageKey,
      string? responseComment,
      DateTime nowUtc)
    {
        if (requestId == Guid.Empty)
            throw new DomainArgumentException("RequestId can't be empty.");
        if (respondingPharmacyId == Guid.Empty)
            throw new DomainArgumentException("RespondingPharmacyId can't be empty.");
        if (respondingAdminId == Guid.Empty)
            throw new DomainArgumentException("RespondingAdminId can't be empty.");

        Id = Guid.NewGuid();
        RequestId = requestId;
        RespondingPharmacyId = respondingPharmacyId;
        RespondingAdminId = respondingAdminId;
        FullName = NormalizeRequiredString(fullName, MaxFullNameLength, nameof(FullName));
        Price = ValidatePrice(price);
        Quantity = ValidateQuantity(quantity);
        ImageKey = NormalizeOptionalString(imageKey, 1024, nameof(ImageKey));
        ResponseComment = NormalizeOptionalString(responseComment, MaxResponseCommentLength, nameof(ResponseComment));
        CreatedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>In-place update from the same pharmacy resubmitting their
    /// response. Caller is the parent aggregate (request) — public-internal
    /// to keep the invariant that responses can't migrate between pharmacies.</summary>
    internal void Update(
      Guid respondingAdminId,
      string fullName,
      decimal price,
      int quantity,
      string? imageKey,
      string? responseComment,
      DateTime nowUtc)
    {
        if (respondingAdminId == Guid.Empty)
            throw new DomainArgumentException("RespondingAdminId can't be empty.");

        RespondingAdminId = respondingAdminId;
        FullName = NormalizeRequiredString(fullName, MaxFullNameLength, nameof(FullName));
        Price = ValidatePrice(price);
        Quantity = ValidateQuantity(quantity);
        ImageKey = NormalizeOptionalString(imageKey, 1024, nameof(ImageKey));
        ResponseComment = NormalizeOptionalString(responseComment, MaxResponseCommentLength, nameof(ResponseComment));
        UpdatedAtUtc = nowUtc;
    }

    private static decimal ValidatePrice(decimal price)
    {
        if (price <= 0m)
            throw new DomainArgumentException("Price must be greater than zero.");
        return price;
    }

    private static int ValidateQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new DomainArgumentException("Quantity must be greater than zero.");
        return quantity;
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
