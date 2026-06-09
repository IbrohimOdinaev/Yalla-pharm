"use client";

import { formatMoney } from "@/shared/lib/format";
import { Icon } from "@/shared/ui";
import type { PaymentMethodId } from "@/widgets/payment/PaymentMethodModal";

type PaymentQrPanelProps = {
  method: {
    id: PaymentMethodId;
    title: string;
    subtitle: string;
    url: string;
  };
  amount: number;
  onOpen: () => void;
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

export function PaymentQrPanel({ method, amount, onOpen }: PaymentQrPanelProps) {
  const style = methodStyles[method.id];

  return (
    <div className="rounded-2xl border border-outline/60 bg-surface-container-lowest p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl font-display text-base font-black ${style.className}`}>
            {style.label}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-extrabold text-on-surface">{method.title}</span>
            <span className="mt-0.5 block text-xs text-on-surface-variant">{method.subtitle}</span>
            <span className="mt-1 block text-xs font-bold text-primary">{formatMoney(amount)}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-extrabold text-white transition hover:bg-primary-press sm:w-auto"
        >
          Открыть оплату
          <Icon name="arrow-right" size={16} />
        </button>
      </div>
    </div>
  );
}
