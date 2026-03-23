const INTENT_KEY = "yalla.guest.checkout.intent.v1";

export function setGuestCheckoutIntent(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(INTENT_KEY, "1");
}

export function consumeGuestCheckoutIntent(): boolean {
  if (typeof window === "undefined") return false;
  const had = window.sessionStorage.getItem(INTENT_KEY) === "1";
  window.sessionStorage.removeItem(INTENT_KEY);
  return had;
}
