namespace Yalla.Application.DTO.Request;

public sealed class UpsertClientAddressRequest
{
  public string Address { get; init; } = string.Empty;
  public string? Title { get; init; }
  public double Latitude { get; init; }
  public double Longitude { get; init; }
}
