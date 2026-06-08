function normalizePhone(value: string | null): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function buildPaymentQrValue(deepLinkUrl: string): string {
  try {
    const parsed = new URL(deepLinkUrl);
    if (parsed.protocol === "alifmobi:" && typeof window !== "undefined" && window.location.origin) {
      const phone = normalizePhone(parsed.searchParams.get("account"));
      const amount = parsed.searchParams.get("summa")?.trim();
      if (phone && amount) {
        const redirectUrl = new URL("/api/payment/deeplink", window.location.origin);
        redirectUrl.searchParams.set("provider", "alif");
        redirectUrl.searchParams.set("phone", phone);
        redirectUrl.searchParams.set("amount", amount);
        return redirectUrl.toString();
      }
    }
  } catch {
    return deepLinkUrl;
  }

  return deepLinkUrl;
}
