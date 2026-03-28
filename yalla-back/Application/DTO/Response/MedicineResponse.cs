namespace Yalla.Application.DTO.Response;

public sealed class MedicineResponse
{
  public Guid Id { get; init; }
  public string Title { get; init; } = string.Empty;
  public string? Articul { get; init; }
  public string Description { get; init; } = string.Empty;
  public bool IsActive { get; init; }
  public int? WooCommerceId { get; init; }
  public Guid? CategoryId { get; init; }
  public string? CategoryName { get; init; }
  public IReadOnlyCollection<MedicineImageResponse> Images { get; init; } = [];
  public IReadOnlyCollection<MedicineAtributeResponse> Atributes { get; init; } = [];
  public IReadOnlyCollection<MedicineOfferResponse> Offers { get; init; } = [];
}
