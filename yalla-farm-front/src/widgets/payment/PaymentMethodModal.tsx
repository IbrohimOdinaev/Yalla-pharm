"use client";

import { formatMoney } from "@/shared/lib/format";
import { Icon } from "@/shared/ui";

export type PaymentMethodId = "dc" | "alif" | "eskhata";

export type PaymentMethodOption = {
  id: PaymentMethodId;
  title: string;
  subtitle: string;
  url: string;
};

type Props = {
  open: boolean;
  amount: number;
  methods: PaymentMethodOption[];
  onSelect: (method: PaymentMethodOption) => void;
  onClose: () => void;
};

const methodStyles: Record<PaymentMethodId, { label: string; className: string }> = {
  dc: {
    label: "DC",
    className: "bg-[#f49719] text-on-surface",
  },
  alif: {
    label: "A",
    className: "bg-[#10a37f] text-white",
  },
  eskhata: {
    label: "E",
    className: "bg-[#2454a6] text-white",
  },
};

export function buildPaymentUrlFromTemplate(template: string | null | undefined, amount: number) {
  const source = String(template ?? "")
    .trim()
    .replace(/^https:\/\/eskhata:\/\//i, "eskhata://");
  if (!source) return "";

  const amountText = amount.toFixed(2);
  if (source.includes("{amount}")) {
    return source.split("{amount}").join(amountText);
  }

  try {
    const url = new URL(source);
    if (url.searchParams.has("summa")) {
      url.searchParams.set("summa", amountText);
      return url.toString();
    }
    if (url.searchParams.has("s")) {
      url.searchParams.set("s", amountText);
      return url.toString();
    }
  } catch {
    // Custom deep links are not always accepted by URL in every browser.
  }

  return source;
}

export function PaymentMethodModal({ open, amount, methods, onSelect, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-[28px] bg-surface p-5 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-on-surface">Выберите способ оплаты</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              К оплате: <span className="font-bold text-primary">{formatMoney(amount)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-container-low text-on-surface"
            aria-label="Закрыть"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {methods.map((method) => {
            const style = methodStyles[method.id];
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onSelect(method)}
                className="flex w-full items-center gap-3 rounded-2xl border border-outline/60 bg-surface-container-lowest p-3 text-left transition hover:border-accent hover:bg-accent-soft/40"
              >
                <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl font-display text-base font-black ${style.className}`}>
                  {style.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-extrabold text-on-surface">{method.title}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">{method.subtitle}</span>
                </span>
                <Icon name="arrow-right" size={18} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
