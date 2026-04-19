using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

/// <summary>
/// Source-agnostic checkout line. Knows the medicine and quantity plus —
/// optionally — the originating basket-position id, so basket-source checkouts
/// can clean up that specific row after the order is placed.
/// </summary>
public sealed class PositionDraft
{
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
  public Medicine Medicine { get; init; } = null!;
  public Guid? BasketPositionId { get; init; }
}
