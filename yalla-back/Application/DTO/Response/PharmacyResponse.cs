namespace Yalla.Application.DTO.Response;

public sealed class PharmacyResponse
{
  public Guid Id { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Address { get; init; } = string.Empty;
  public Guid AdminId { get; init; }
  public bool IsActive { get; init; }
  public double? Latitude { get; init; }
  public double? Longitude { get; init; }
  public string? IconUrl { get; init; }
}
