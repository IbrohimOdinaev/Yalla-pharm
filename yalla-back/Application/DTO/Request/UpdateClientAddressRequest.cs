namespace Yalla.Application.DTO.Request;

/// <summary>Partial update. Null fields are ignored (except <see cref="Title"/> which uses empty string to clear).</summary>
public sealed class UpdateClientAddressRequest
{
  public string? Title { get; init; }
  public string? Address { get; init; }
  public double? Latitude { get; init; }
  public double? Longitude { get; init; }
  public bool ClearTitle { get; init; }
}
