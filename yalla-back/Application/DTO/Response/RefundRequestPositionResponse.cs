namespace Yalla.Application.DTO.Response;

public sealed class RefundRequestPositionResponse
{
  public Guid RefundRequestPositionId { get; init; }
  public Guid OrderPositionId { get; init; }
  public Guid MedicineId { get; init; }
  public string MedicineName { get; init; } = string.Empty;
  public int Quantity { get; init; }
  public decimal UnitPrice { get; init; }
  public decimal LineTotal { get; init; }
}
