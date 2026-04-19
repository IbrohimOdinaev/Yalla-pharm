import type { ApiOrder } from "@/shared/types/api";

/** Price × quantity total for rejected positions (refund for never-given items). */
export function computeRejectedRefund(order: ApiOrder): number {
  return (order.positions ?? [])
    .filter((p) => p.isRejected)
    .reduce((sum, p) => sum + (p.price ?? 0) * (p.quantity ?? 0), 0);
}

/** Price × returnedQuantity for non-rejected positions (post-delivery returns). */
export function computeReturnedRefund(order: ApiOrder): number {
  return (order.positions ?? [])
    .filter((p) => !p.isRejected)
    .reduce((sum, p) => sum + (p.price ?? 0) * (p.returnedQuantity ?? 0), 0);
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
    .reduce((sum, p) => sum + (p.price ?? 0) * Math.max(0, (p.quantity ?? 0) - (p.returnedQuantity ?? 0)), 0);
}

/**
 * Items total only (price × quantity for all lines). No delivery cost.
 * Stable: never decreases as items are rejected, returned or order is cancelled.
 */
export function computeItemsTotal(order: ApiOrder): number {
  const positionsSum = (order.positions ?? [])
    .reduce((sum, p) => sum + (p.price ?? 0) * (p.quantity ?? 0), 0);
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
