export type StoredPaymentMethodId = "dc" | "alif" | "eskhata";

const PAYMENT_METHOD_BY_ORDER_KEY = "yalla-pharm.payment-method-by-order.v1";

function readMap(): Record<string, StoredPaymentMethodId> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PAYMENT_METHOD_BY_ORDER_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StoredPaymentMethodId>;
  } catch {
    return {};
  }
}

export function rememberOrderPaymentMethod(orderId: string | null | undefined, methodId: StoredPaymentMethodId) {
  if (typeof window === "undefined" || !orderId) return;
  const current = readMap();
  current[orderId] = methodId;
  window.localStorage.setItem(PAYMENT_METHOD_BY_ORDER_KEY, JSON.stringify(current));
}

export function getRememberedOrderPaymentMethod(orderId: string | null | undefined): StoredPaymentMethodId | null {
  if (!orderId) return null;
  return readMap()[orderId] ?? null;
}

export function paymentProviderToMethodId(provider: string | null | undefined): StoredPaymentMethodId | null {
  const value = provider?.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (!value || value === "legacy") return null;
  if (value.includes("alif")) return "alif";
  if (value.includes("eskhata") || value.includes("esxata")) return "eskhata";
  if (value.includes("dushanbe") || value === "dc") return "dc";
  return null;
}
