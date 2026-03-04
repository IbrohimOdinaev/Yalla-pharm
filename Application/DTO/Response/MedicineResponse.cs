namespace Yalla.Application.DTO.Response;

public sealed class MedicineResponse
{
  public Guid Id { get; init; }
  public string? Url { get; init; }
  public string Title { get; init; } = string.Empty;
  public string Articul { get; init; } = string.Empty;
  public bool IsActive { get; init; }
  public IReadOnlyCollection<MedicineAtributeResponse> Atributes { get; init; } = [];
}
