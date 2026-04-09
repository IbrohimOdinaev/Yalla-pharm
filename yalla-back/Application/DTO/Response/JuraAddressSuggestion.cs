namespace Yalla.Application.DTO.Response;

public sealed class JuraAddressSuggestion
{
  public long Id { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Address { get; init; } = string.Empty;
  public string Type { get; init; } = string.Empty;
  public double Lat { get; init; }
  public double Lng { get; init; }
}
