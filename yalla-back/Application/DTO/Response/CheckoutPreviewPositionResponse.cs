namespace Yalla.Application.DTO.Response;

public sealed class CheckoutPreviewPositionResponse
{
  public Guid PositionId { get; init; }
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
  public bool IsRejected { get; init; }
  public int FoundQuantity { get; init; }
  public decimal? Price { get; init; }
  public string Reason { get; init; } = string.Empty;

  /// <summary>Pharmacist's "by units" override copied from the
  /// prescription. UI uses these to show "N штук — TJS X" instead of
  /// the offer-price × quantity formula.</summary>
  public bool UseUnitMode { get; init; }
  public int? UnitCount { get; init; }
  public decimal? UnitTotalPrice { get; init; }
}
