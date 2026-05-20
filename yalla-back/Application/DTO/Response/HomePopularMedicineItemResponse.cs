namespace Yalla.Application.DTO.Response;

public sealed class HomePopularMedicineItemResponse
{
  public Guid MedicineId { get; init; }
  public int Position { get; init; }
  public MedicineSearchItemResponse Medicine { get; init; } = new();
}
