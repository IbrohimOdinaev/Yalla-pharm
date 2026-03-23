export function buildCheckoutIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `checkout-${crypto.randomUUID()}`;
  }

  return `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
