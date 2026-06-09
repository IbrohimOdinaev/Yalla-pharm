import { formatMoney } from "@/shared/lib/format";
import { openPaymentQrWindow } from "@/shared/lib/paymentQr";
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

export function openPaymentForCurrentDevice(input: ResponsivePaymentInput): boolean {
  if (shouldShowDesktopQrPage()) {
    void openPaymentQrWindow({
      deepLinkUrl: input.url,
      title: input.title,
      amountLabel: `Сумма: ${formatMoney(input.amount)}`,
      walletLabel: input.subtitle,
    });
    return true;
  }

  return openPaymentUrl(input.url);
}
