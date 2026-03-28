namespace Yalla.Application.DTO.Request;

public sealed class UpdatePharmacyRequest
{
  public Guid PharmacyId { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Address { get; init; } = string.Empty;
  public Guid AdminId { get; init; }
  public bool IsActive { get; init; }
  public double? Latitude { get; init; }
  public double? Longitude { get; init; }
}
