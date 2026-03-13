namespace Yalla.Application.DTO.Response;

public sealed class OrderHistoryPositionResponse
{
  public Guid PositionId { get; init; }
  public string MedicineTitle { get; init; } = string.Empty;
}
