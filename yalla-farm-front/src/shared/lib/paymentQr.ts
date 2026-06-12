type PaymentQrWindowInput = {
  deepLinkUrl: string;
  title: string;
  amountLabel?: string;
  walletLabel?: string;
};

function parseAmount(amountLabel?: string): string | null {
  const match = String(amountLabel ?? "").match(/(\d+(?:[.,]\d+)?)/);
  return match?.[1]?.replace(",", ".") ?? null;
}

function buildPaymentQrPageUrl(input: PaymentQrWindowInput): string {
  const url = new URL("/payment-qr", window.location.origin);
  url.searchParams.set("url", input.deepLinkUrl);
  url.searchParams.set("title", input.title);
  const amount = parseAmount(input.amountLabel);
  if (amount) url.searchParams.set("amount", amount);
  if (input.walletLabel) url.searchParams.set("subtitle", input.walletLabel);
  return url.toString();
}

export async function openPaymentQrWindow(input: PaymentQrWindowInput): Promise<boolean> {
  if (typeof window === "undefined" || !input.deepLinkUrl.trim()) return false;

  return Boolean(window.open(buildPaymentQrPageUrl(input), "_blank", "noopener,noreferrer"));
}
