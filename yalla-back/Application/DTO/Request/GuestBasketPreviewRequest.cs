namespace Yalla.Application.DTO.Request;

/// <summary>
/// Used by the anonymous (guest) cart to compute per-pharmacy totals without a client identity.
/// Mirrors the authenticated basket's <c>PharmacyOptions</c> response so the UI can share the
/// same "от X TJS" best-price logic regardless of auth state.
/// </summary>
public sealed class GuestBasketPreviewRequest
{
  public IReadOnlyCollection<GuestBasketItemRequest> Positions { get; init; } = [];
}

public sealed class GuestBasketItemRequest
{
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
}
