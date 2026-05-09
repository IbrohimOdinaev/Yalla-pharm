namespace Yalla.Application.DTO.Request;

/// <summary>
/// Body for <c>POST /api/prescriptions/{id}/move-to-cart</c>.
///
/// <para><c>QuantityOverrides</c> — per-item quantity edits the client made
/// on the prescription detail page; keys are <c>PrescriptionChecklistItem.Id</c>.
/// Items absent from the map keep the pharmacist-recommended quantity.
/// A value of <c>0</c> drops the item from the order entirely (and on the
/// pair side, removes that side from the pair so the order falls back to
/// the other one — see selection rules below).</para>
///
/// <para><c>PairSelections</c> — for paired (original ↔ analog) items
/// the client picks which side to actually order. Keys are the original
/// item's id (the row that carries <c>AnalogItemId</c>), values are
/// either the original's id or the analog's id. Default selection when
/// the pair is absent from the map is the analog (cheaper substitute).
/// If the chosen side has no offers, qty = 0, or is a manual / undecoded
/// row, the service falls back to the other side or skips the pair.</para>
/// </summary>
public sealed class MoveChecklistToCartRequest
{
  public Dictionary<Guid, int>? QuantityOverrides { get; init; }
  public Dictionary<Guid, Guid>? PairSelections { get; init; }
}
