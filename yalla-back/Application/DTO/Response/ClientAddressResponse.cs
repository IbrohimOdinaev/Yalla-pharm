namespace Yalla.Application.DTO.Response;

public sealed class ClientAddressResponse
{
  public Guid Id { get; init; }
  public string Address { get; init; } = string.Empty;
  public string? Title { get; init; }
  public double Latitude { get; init; }
  public double Longitude { get; init; }
  public DateTime LastUsedAtUtc { get; init; }
  public DateTime CreatedAtUtc { get; init; }
}
