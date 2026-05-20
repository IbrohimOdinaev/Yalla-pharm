using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class ExternalProductLink
{
  public Guid Id { get; private set; }
  public Guid SourceId { get; private set; }
  public Guid PharmacyId { get; private set; }
  public string SourceType { get; private set; } = string.Empty;
  public string ExternalProductId { get; private set; } = string.Empty;
  public string? ExternalBarcode { get; private set; }
  public string? ExternalTitle { get; private set; }
  public Guid? MedicineId { get; private set; }
  public string MatchStatus { get; private set; } = "manual_required";
  public string MatchMethod { get; private set; } = "none";
  public decimal? Confidence { get; private set; }
  public DateTime FirstSeenAtUtc { get; private set; }
  public DateTime LastSeenAtUtc { get; private set; }

  private ExternalProductLink() { }

  public ExternalProductLink(
    Guid sourceId,
    Guid pharmacyId,
    string sourceType,
    string externalProductId,
    string? externalBarcode,
    string? externalTitle,
    DateTime nowUtc)
  {
    if (sourceId == Guid.Empty)
      throw new DomainArgumentException("ExternalProductLink.SourceId can't be empty.");

    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("ExternalProductLink.PharmacyId can't be empty.");

    if (string.IsNullOrWhiteSpace(sourceType))
      throw new DomainArgumentException("ExternalProductLink.SourceType can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(externalProductId))
      throw new DomainArgumentException("ExternalProductLink.ExternalProductId can't be null or whitespace.");

    Id = Guid.NewGuid();
    SourceId = sourceId;
    PharmacyId = pharmacyId;
    SourceType = sourceType.Trim().ToLowerInvariant();
    ExternalProductId = externalProductId.Trim();
    ExternalBarcode = NormalizeNullable(externalBarcode);
    ExternalTitle = NormalizeNullable(externalTitle);
    FirstSeenAtUtc = nowUtc;
    LastSeenAtUtc = nowUtc;
  }

  public void UpdateExternalSnapshot(string? externalBarcode, string? externalTitle, DateTime nowUtc)
  {
    ExternalBarcode = NormalizeNullable(externalBarcode);
    ExternalTitle = NormalizeNullable(externalTitle);
    LastSeenAtUtc = nowUtc;
  }

  public void AutoMatch(Guid medicineId, string method, decimal confidence)
  {
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("ExternalProductLink.MedicineId can't be empty.");

    MedicineId = medicineId;
    MatchStatus = "auto_matched";
    MatchMethod = string.IsNullOrWhiteSpace(method) ? "auto" : method.Trim().ToLowerInvariant();
    Confidence = confidence;
  }

  public void RequireManualReview(string method = "none", decimal? confidence = null)
  {
    MedicineId = null;
    MatchStatus = "manual_required";
    MatchMethod = string.IsNullOrWhiteSpace(method) ? "none" : method.Trim().ToLowerInvariant();
    Confidence = confidence;
  }

  public void Confirm(Guid medicineId, string method = "manual", decimal confidence = 1m)
  {
    if (medicineId == Guid.Empty)
      throw new DomainArgumentException("ExternalProductLink.MedicineId can't be empty.");

    MedicineId = medicineId;
    MatchStatus = "confirmed";
    MatchMethod = string.IsNullOrWhiteSpace(method) ? "manual" : method.Trim().ToLowerInvariant();
    Confidence = confidence;
  }

  private static string? NormalizeNullable(string? value)
  {
    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
  }
}
