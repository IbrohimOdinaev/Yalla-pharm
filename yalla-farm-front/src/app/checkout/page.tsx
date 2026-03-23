"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/shared/api/http-client";
import { buildCheckoutIdempotencyKey } from "@/shared/lib/idempotency";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { usePaymentIntentLiveState } from "@/features/checkout/model/usePaymentIntentLiveState";
import type { ApiCheckoutResponse } from "@/shared/types/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

const PENDING_KEY = "yalla.front.pending.payment.intent";

const PAYMENT_INTENT_STATE = {
  Confirmed: 2,
  Rejected: 3,
  NeedsResolution: 4
} as const;

type PendingCheckoutState = {
  paymentIntentId: string;
  reservedOrderId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
};

function readPendingCheckout(): PendingCheckoutState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCheckoutState>;

    if (!parsed.paymentIntentId || !parsed.reservedOrderId) return null;

    return {
      paymentIntentId: String(parsed.paymentIntentId),
      reservedOrderId: String(parsed.reservedOrderId),
      paymentUrl: String(parsed.paymentUrl || ""),
      amount: Number(parsed.amount || 0),
      currency: String(parsed.currency || "TJS")
    };
  } catch {
    return null;
  }
}

function writePendingCheckout(value: PendingCheckoutState | null): void {
  if (typeof window === "undefined") return;

  if (!value) {
    window.localStorage.removeItem(PENDING_KEY);
    return;
  }

  window.localStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

export default function CheckoutPage() {
  const token = useAppSelector((state) => state.auth.token);
  const { basket, loadBasket } = useCartStore((state) => state);
  const { pharmacyId, deliveryAddress, isPickup, setDraft } = useCheckoutDraftStore((state) => state);

  const [pending, setPending] = useState<PendingCheckoutState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const liveState = usePaymentIntentLiveState(pending?.paymentIntentId ?? null, token);

  useEffect(() => {
    if (!token) return;
    loadBasket(token).catch(() => undefined);
  }, [token, loadBasket]);

  useEffect(() => {
    const cached = readPendingCheckout();
    if (cached) {
      setPending(cached);
    }
  }, []);

  useEffect(() => {
    if (!pending) return;

    const intentState = Number(liveState.data?.paymentIntent?.state ?? NaN);

    if (intentState === PAYMENT_INTENT_STATE.Confirmed && liveState.data?.orderId) {
      setSuccessMessage(`Оплата подтверждена. Заказ ${String(liveState.data.orderId).slice(0, 8)} оформлен.`);
      setPending(null);
      writePendingCheckout(null);
      return;
    }

    if (intentState === PAYMENT_INTENT_STATE.Rejected) {
      setError("Оплата отклонена SuperAdmin. Проверьте перевод и повторите попытку.");
    }

    if (intentState === PAYMENT_INTENT_STATE.NeedsResolution) {
      setError("Оплата требует ручной проверки. Ожидайте решения SuperAdmin.");
    }
  }, [liveState.data, pending]);

  useEffect(() => {
    if (pharmacyId) return;

    const firstOption = (basket.pharmacyOptions ?? []).find((option) => option?.isAvailable) ?? (basket.pharmacyOptions ?? [])[0];
    if (firstOption?.pharmacyId) {
      setDraft({ pharmacyId: String(firstOption.pharmacyId) });
    }
  }, [basket.pharmacyOptions, pharmacyId, setDraft]);

  const selectedOption = useMemo(() => {
    return (basket.pharmacyOptions ?? []).find((option) => String(option.pharmacyId) === String(pharmacyId));
  }, [basket.pharmacyOptions, pharmacyId]);

  const estimatedAmount = Number(selectedOption?.totalCost ?? pending?.amount ?? 0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!pharmacyId) {
        throw new Error("Выберите аптеку перед оформлением.");
      }

      const idempotencyKey = buildCheckoutIdempotencyKey();
      const payload = {
        pharmacyId,
        isPickup,
        deliveryAddress,
        idempotencyKey,
        ignoredPositionIds: []
      };

      await apiFetch("/api/clients/checkout/preview", {
        method: "POST",
        token,
        body: payload
      });

      const checkout = await apiFetch<ApiCheckoutResponse>("/api/clients/checkout", {
        method: "POST",
        token,
        body: payload
      });

      const nextPending: PendingCheckoutState = {
        paymentIntentId: String(checkout.paymentIntentId || ""),
        reservedOrderId: String(checkout.reservedOrderId || checkout.orderId || ""),
        paymentUrl: String(checkout.paymentUrl || ""),
        amount: Number(checkout.cost || checkout.amount || 0),
        currency: String(checkout.currency || "TJS")
      };

      setPending(nextPending);
      writePendingCheckout(nextPending);

      if (nextPending.paymentUrl) {
        const confirmed = window.confirm("Перейти на страницу оплаты DushanbeCity сейчас?");
        if (confirmed) {
          window.location.assign(nextPending.paymentUrl);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось оформить checkout.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AppShell top={<TopBar title="Checkout" backHref="/cart" />}>
        <div className="stitch-card p-6 text-sm">
          Для оформления заказа войдите в аккаунт: <Link href="/login" className="font-bold text-primary">вход</Link>.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Checkout" backHref="/cart" />}>
      <div className="space-y-4">
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
        {successMessage ? <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{successMessage}</div> : null}

        <section className="stitch-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Детали доставки</h2>

          <label className="block space-y-1">
            <span className="text-sm text-on-surface-variant">Аптека</span>
            <select
              className="stitch-input"
              value={pharmacyId}
              onChange={(e) => setDraft({ pharmacyId: e.target.value })}
              required
            >
              <option value="">Выберите аптеку</option>
              {(basket.pharmacyOptions ?? []).map((option) => (
                <option key={option.pharmacyId} value={option.pharmacyId}>
                  {option.pharmacyTitle || option.pharmacyId}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-on-surface-variant">Адрес</span>
            <input
              className="stitch-input"
              value={deliveryAddress}
              onChange={(e) => setDraft({ deliveryAddress: e.target.value })}
              placeholder="Rudaki Ave, Dushanbe"
              required={!isPickup}
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 text-sm font-medium">
            <input type="checkbox" checked={isPickup} onChange={(e) => setDraft({ isPickup: e.target.checked })} />
            Самовывоз из аптеки
          </label>

          <div className="rounded-xl bg-surface-container-low p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Сумма</span>
              <strong>{formatMoney(estimatedAmount, pending?.currency || "TJS")}</strong>
            </div>
          </div>

          <form onSubmit={onSubmit}>
            <button className="stitch-button w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Оформляем..." : "Оплатить сейчас"}
            </button>
          </form>
        </section>

        {pending ? (
          <section className="stitch-card space-y-3 p-5">
            <h3 className="text-lg font-bold">Ожидаем подтверждение оплаты</h3>
            <p className="text-sm text-on-surface-variant">Order ID: {pending.reservedOrderId}</p>
            <p className="text-sm text-on-surface-variant">Сумма: {formatMoney(pending.amount, pending.currency)}</p>

            {liveState.isLoading ? <p className="text-sm">Проверяем статус оплаты...</p> : null}
            {liveState.error ? <p className="text-sm text-red-600">{liveState.error}</p> : null}

            {pending.paymentUrl ? (
              <a href={pending.paymentUrl} className="stitch-button-secondary inline-block" target="_blank" rel="noreferrer">
                Открыть страницу оплаты
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
