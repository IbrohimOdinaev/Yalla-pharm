namespace Yalla.Application.DTO.Request;

public sealed class UpdatePharmacyRequest
{
  public Guid PharmacyId { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Address { get; init; } = string.Empty;
  public Guid? AdminId { get; init; }
  public bool IsActive { get; init; }
  public double? Latitude { get; init; }
  public double? Longitude { get; init; }
  public string? IconUrl { get; init; }
  public string? BannerUrl { get; init; }

  /// "HH:mm" or "HH:mm:ss". Send both OpensAt and ClosesAt together to set a
  /// schedule, or both null to mark the pharmacy as 24/7.
  public string? OpensAt { get; init; }
  public string? ClosesAt { get; init; }
}
