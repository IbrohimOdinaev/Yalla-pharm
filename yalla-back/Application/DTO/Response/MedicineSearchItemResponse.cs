namespace Yalla.Application.DTO.Response;

public sealed class MedicineSearchItemResponse
{
  public Guid Id { get; init; }
  public string Title { get; init; } = string.Empty;
  public string? Articul { get; init; }
  public bool IsActive { get; init; } = true;
  public decimal? MinPrice { get; init; }
  public string? CategoryName { get; init; }
  public IReadOnlyCollection<MedicineImageResponse> Images { get; init; } = [];
}
