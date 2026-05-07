namespace Yalla.Application.DTO.Request;

/// <summary>
/// Body for <c>POST /api/prescriptions/{id}/move-to-cart</c>. Carries the
/// (optional) per-item quantity overrides the client may have edited on the
/// prescription detail page — keys are <c>PrescriptionChecklistItem.Id</c>,
/// values are the client-chosen quantities. Items not present in the map keep
/// the pharmacist-recommended quantity.
/// </summary>
public sealed class MoveChecklistToCartRequest
{
  public Dictionary<Guid, int>? QuantityOverrides { get; init; }
}
