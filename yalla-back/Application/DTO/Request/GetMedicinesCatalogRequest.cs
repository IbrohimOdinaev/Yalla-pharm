namespace Yalla.Application.DTO.Request;

public sealed class GetMedicinesCatalogRequest
{
  public string Query { get; init; } = string.Empty;
  public Guid? CategoryId { get; init; }
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
