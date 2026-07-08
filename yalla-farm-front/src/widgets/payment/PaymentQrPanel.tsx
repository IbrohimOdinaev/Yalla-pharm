"use client";

import { Icon } from "@/shared/ui";
import { PaymentMethodLogo } from "@/widgets/payment/PaymentMethodLogo";
import type { PaymentMethodId } from "@/widgets/payment/PaymentMethodModal";

type PaymentQrPanelProps = {
  method: {
    id: PaymentMethodId;
    title: string;
    subtitle: string;
    url: string;
  };
  onOpen: () => void;
};

export function PaymentQrPanel({ method, onOpen }: PaymentQrPanelProps) {
  return (
    <div className="rounded-2xl border border-outline/60 bg-surface-container-lowest p-3">
      <div className="flex items-center justify-between gap-3">
        <PaymentMethodLogo methodId={method.id} className="h-12 w-24 px-2" />
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Открыть оплату через ${method.title}`}
          className="inline-flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-extrabold text-white transition hover:bg-primary-press sm:w-auto"
        >
          Открыть оплату
          <Icon name="arrow-right" size={16} />
        </button>
      </div>
    </div>
  );
}
