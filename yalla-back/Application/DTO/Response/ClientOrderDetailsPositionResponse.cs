namespace Yalla.Application.DTO.Response;

public sealed class ClientOrderDetailsPositionResponse
{
  public Guid PositionId { get; init; }
  public Guid MedicineId { get; init; }
  public string MedicineTitle { get; init; } = string.Empty;
  public int Quantity { get; init; }
  public int ReturnedQuantity { get; init; }
  public bool IsRejected { get; init; }
  public decimal Price { get; init; }
  /// <summary>Cover/main image for this medicine, when available. The
  /// /orders detail expander uses it to render the per-position thumb
  /// inline without a follow-up /api/medicines/by-ids round-trip.</summary>
  public ClientOrderDetailsPositionImageResponse? Image { get; init; }

  /// <summary>Pharmacist-supplied "by units" override frozen on the
  /// position at order-creation time. UI renders unit count + total
  /// price instead of <see cref="Price"/> × <see cref="Quantity"/>.</summary>
  public bool UseUnitMode { get; init; }
  public int? UnitCount { get; init; }
  public decimal? UnitTotalPrice { get; init; }
}

public sealed class ClientOrderDetailsPositionImageResponse
{
  public Guid Id { get; init; }
  public string Key { get; init; } = string.Empty;
  public bool IsMain { get; init; }
  public bool IsMinimal { get; init; }
}
