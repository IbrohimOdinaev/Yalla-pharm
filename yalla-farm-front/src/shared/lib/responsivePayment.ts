import { openPaymentUrl } from "@/shared/lib/paymentWindow";

type ResponsivePaymentInput = {
  url: string;
  title: string;
  amount: number;
  subtitle?: string;
};

function shouldShowDesktopQrPage(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches;
}

function buildPaymentQrPageUrl(input: ResponsivePaymentInput): string {
  const url = new URL("/payment-qr", window.location.origin);
  url.searchParams.set("url", input.url);
  url.searchParams.set("title", input.title);
  url.searchParams.set("amount", String(input.amount));
  if (input.subtitle) url.searchParams.set("subtitle", input.subtitle);
  return url.toString();
}

export function openPaymentForCurrentDevice(input: ResponsivePaymentInput): boolean {
  if (shouldShowDesktopQrPage()) {
    return Boolean(window.open(buildPaymentQrPageUrl(input), "_blank", "noopener,noreferrer"));
  }

  return openPaymentUrl(input.url);
}
