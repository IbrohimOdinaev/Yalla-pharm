"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/shared/lib/format";
import { useBodyScrollLock } from "@/shared/lib/useBodyScrollLock";
import { Icon } from "@/shared/ui";
import { PaymentQrPanel } from "@/widgets/payment/PaymentQrPanel";

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

export function buildPaymentUrlFromTemplate(template: string | null | undefined, amount: number) {
  const source = String(template ?? "")
    .trim()
    .replace(/^https:\/\/eskhata:\/\//i, "eskhata://");
  if (!source) return "";

  const amountText = amount.toFixed(2);
  if (source.includes("{amount}") || source.includes("{amaunt}")) {
    return source
      .split("{amount}").join(amountText)
      .split("{amaunt}").join(amountText);
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
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[28px] bg-surface p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-method-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="payment-method-title" className="font-display text-lg font-extrabold text-on-surface">Выберите способ оплаты</h2>
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
          {methods.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              Сейчас нет доступных способов оплаты. Попробуйте позже или свяжитесь с поддержкой.
            </div>
          ) : methods.map((method) => (
            <PaymentQrPanel
              key={method.id}
              method={method}
              amount={amount}
              onOpen={() => onSelect(method)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
