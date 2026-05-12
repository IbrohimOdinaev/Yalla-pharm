import type { ApiOrder, ApiOrderPosition } from "@/shared/types/api";

/** Effective per-line full total (everything if nothing returned). For
 *  unit-mode rows the pharmacist's flat `unitTotalPrice` wins — it
 *  replaces the system's price × quantity formula. */
function lineFullTotal(p: ApiOrderPosition): number {
  if (p.useUnitMode && p.unitTotalPrice != null) return p.unitTotalPrice;
  return (p.price ?? 0) * (p.quantity ?? 0);
}

/** Pro-rata share of a unit-mode row when only part of the packages
 *  were returned. Catalog rows fall back to price × n. */
function lineSharePrice(p: ApiOrderPosition, n: number): number {
  if (p.useUnitMode && p.unitTotalPrice != null && (p.quantity ?? 0) > 0) {
    return Math.round((p.unitTotalPrice * n / p.quantity!) * 100) / 100;
  }
  return (p.price ?? 0) * n;
}

/** Refund for rejected positions (full line total, never given). */
export function computeRejectedRefund(order: ApiOrder): number {
  return (order.positions ?? [])
    .filter((p) => p.isRejected)
    .reduce((sum, p) => sum + lineFullTotal(p), 0);
}

/** Refund for returned units on non-rejected positions. */
export function computeReturnedRefund(order: ApiOrder): number {
  return (order.positions ?? [])
    .filter((p) => !p.isRejected)
    .reduce((sum, p) => sum + lineSharePrice(p, p.returnedQuantity ?? 0), 0);
}

/** Total refund-due regardless of cancel: rejected + returned. */
export function computeRefundFromPositions(order: ApiOrder): number {
  return computeRejectedRefund(order) + computeReturnedRefund(order);
}

/** What's effectively still owed (kept by client) after rejections and returns. */
export function computeNetCost(order: ApiOrder): number {
  if ((order.cost ?? 0) > 0) return order.cost!;
  return (order.positions ?? [])
    .filter((p) => !p.isRejected)
    .reduce((sum, p) => sum + lineSharePrice(p, Math.max(0, (p.quantity ?? 0) - (p.returnedQuantity ?? 0))), 0);
}

/**
 * Items total only (full line totals). No delivery cost.
 * Stable: never decreases as items are rejected, returned or order is cancelled.
 */
export function computeItemsTotal(order: ApiOrder): number {
  const positionsSum = (order.positions ?? [])
    .reduce((sum, p) => sum + lineFullTotal(p), 0);
  if (positionsSum > 0) return positionsSum;

  // Fallback when positions weren't loaded — use stored totals (Cost+ReturnCost).
  return (order.cost ?? 0) + (order.returnCost ?? 0);
}

/**
 * Original total the client paid at checkout: items + delivery (if any).
 * Stable: never decreases as items are rejected, returned or order is cancelled.
 */
export function computeOriginalPaid(order: ApiOrder): number {
  const items = computeItemsTotal(order);
  const delivery = order.isPickup ? 0 : (order.deliveryCost ?? 0);
  return items + delivery;
}

/**
 * Total refund the client is due for this order:
 * - Cancelled: original paid (everything comes back).
 * - Otherwise: rejected refund + returned refund.
 */
export function computeTotalRefund(order: ApiOrder): number {
  if (order.status === "Cancelled") return computeOriginalPaid(order);
  return computeRefundFromPositions(order);
}

/**
 * Detects orphan orders whose `order_positions` rows are missing in the DB —
 * a handful of historic records pre-date the current Order constructor guard
 * (`positions.Count > 0`) and surface as "0 TJS / 0 поз." cards. UI uses this
 * to render a "data lost" badge so admins don't read them as legitimate empty
 * orders.
 */
export function isOrderDataLost(order: ApiOrder): boolean {
  return (order.positions?.length ?? 0) === 0;
}
