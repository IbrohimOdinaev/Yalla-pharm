import { apiFetch } from "@/shared/api/http-client";
import type { ApiOrder, ApiOrderPosition } from "@/shared/types/api";

const STATUS_MAP: Record<number, string> = {
  0: "New", 1: "UnderReview", 2: "Preparing", 3: "Ready",
  4: "OnTheWay", 5: "Delivered", 6: "Cancelled", 7: "Returned"
};

const PAYMENT_STATE_MAP: Record<number, string> = {
  0: "Confirmed", 1: "PendingManualConfirmation", 2: "Expired"
};

type RawOrder = Record<string, unknown>;

function normalizePosition(raw: Record<string, unknown>): ApiOrderPosition {
  return {
    positionId: String(raw.positionId || raw.id || ""),
    medicineId: String(raw.medicineId || (raw.medicine as Record<string, unknown>)?.id || ""),
    quantity: Number(raw.quantity || 0),
    price: Number(raw.price || 0),
    isRejected: Boolean(raw.isRejected),
    medicine: raw.medicine ? {
      id: String((raw.medicine as Record<string, unknown>).id || (raw.medicine as Record<string, unknown>).medicineId || ""),
      title: String((raw.medicine as Record<string, unknown>).title || ""),
      articul: String((raw.medicine as Record<string, unknown>).articul || ""),
    } : raw.medicineTitle ? {
      id: String(raw.medicineId || ""),
      title: String(raw.medicineTitle),
    } : undefined,
  };
}

export function normalizeOrder(raw: RawOrder): ApiOrder {
  const rawStatus = raw.status;
  const status = typeof rawStatus === "number" ? (STATUS_MAP[rawStatus] ?? String(rawStatus)) : String(rawStatus || "");

  const rawPaymentState = raw.paymentState;
  const paymentState = typeof rawPaymentState === "number" ? (PAYMENT_STATE_MAP[rawPaymentState] ?? String(rawPaymentState)) : (rawPaymentState ? String(rawPaymentState) : undefined);

  const rawPositions = Array.isArray(raw.positions) ? raw.positions : [];
  const positions = rawPositions.map((p: Record<string, unknown>) => normalizePosition(p));

  // Backend may return cost=0 due to a bug; compute from positions as fallback
  let cost = Number(raw.cost || 0);
  if (cost <= 0 && positions.length > 0) {
    cost = positions
      .filter((p) => !p.isRejected)
      .reduce((sum, p) => sum + (p.price ?? 0) * (p.quantity ?? 0), 0);
  }

  return {
    orderId: String(raw.orderId || raw.id || ""),
    status,
    paymentState,
    clientId: raw.clientId ? String(raw.clientId) : undefined,
    clientPhoneNumber: raw.clientPhoneNumber ? String(raw.clientPhoneNumber) : undefined,
    pharmacyId: raw.pharmacyId ? String(raw.pharmacyId) : undefined,
    pharmacyTitle: raw.pharmacyTitle ? String(raw.pharmacyTitle) : undefined,
    deliveryAddress: raw.deliveryAddress ? String(raw.deliveryAddress) : undefined,
    isPickup: Boolean(raw.isPickup),
    createdAtUtc: String(raw.createdAtUtc || raw.orderPlacedAt || ""),
    cost,
    currency: String(raw.currency || raw.paymentCurrency || "TJS"),
    returnCost: Number(raw.returnCost || 0),
    orderPlacedAt: String(raw.orderPlacedAt || raw.createdAtUtc || ""),
    positions,
    refundRequest: raw.refundRequest ? raw.refundRequest as ApiOrder["refundRequest"] : undefined,
  };
}

export async function getClientOrderHistory(token: string): Promise<ApiOrder[]> {
  const response = await apiFetch<{ orders?: RawOrder[]; clientId?: string }>("/api/orders/client-history", { token });
  return Array.isArray(response?.orders) ? response.orders.map(o => normalizeOrder(o as RawOrder)) : [];
}

export async function getOrderById(token: string, orderId: string): Promise<ApiOrder> {
  const response = await apiFetch<RawOrder>(`/api/orders/${orderId}`, { token });
  if (!response) throw new Error("Заказ не найден.");
  return normalizeOrder(response);
}

export async function cancelOrder(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/cancel", { method: "POST", token, body: { orderId } });
}
