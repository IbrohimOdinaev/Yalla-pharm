"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney } from "@/shared/lib/format";
import { usePaymentIntentLiveState } from "@/features/checkout/model/usePaymentIntentLiveState";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

const PENDING_KEY = "yalla.front.pending.payment.intent";

type PendingPayment = {
  paymentIntentId: string;
  reservedOrderId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
  paymentExpiresAtUtc?: string | null;
};

export default function PaymentAwaitPage() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const [pending, setPending] = useState<PendingPayment | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) setPending(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Countdown
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!pending?.paymentExpiresAtUtc) return;
    const expiresAt = pending.paymentExpiresAtUtc;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pending?.paymentExpiresAtUtc]);

  // Live state polling
  const liveState = usePaymentIntentLiveState(pending?.paymentIntentId ?? null, token);

  useEffect(() => {
    const intentState = liveState.data?.paymentIntent?.state;
    if (intentState === 2) {
      // Confirmed
      localStorage.removeItem(PENDING_KEY);
      router.push("/orders");
    }
  }, [liveState, router]);

  if (!pending) {
    return (
      <AppShell top={<TopBar title="Ожидание оплаты" backHref="/cart" />}>
        <div className="stitch-card p-6 text-sm text-on-surface-variant">Сессия ожидания оплаты не найдена.</div>
      </AppShell>
    );
  }

  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft !== null ? secondsLeft % 60 : null;
  const intentState = liveState.data?.paymentIntent?.state;

  return (
    <AppShell top={<TopBar title="Ожидание оплаты" backHref="/cart" />}>
      <div className="space-y-5">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-[#0070eb] p-6 text-white space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">Оплата заказа</p>
          <h1 className="text-2xl font-extrabold">Ожидаем подтверждение</h1>
          <p className="text-sm opacity-80">
            Заказ #{pending.reservedOrderId.slice(0, 8)} &middot; {formatMoney(pending.amount, pending.currency)}
          </p>
          {secondsLeft !== null && secondsLeft > 0 ? (
            <p className="text-lg font-bold">Осталось: {mins}:{String(secs).padStart(2, "0")}</p>
          ) : secondsLeft === 0 ? (
            <p className="text-sm opacity-80">Время истекло</p>
          ) : null}
        </div>

        {/* Status messages */}
        {intentState === 3 && (
          <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">Оплата отклонена.</div>
        )}
        {intentState === 4 && (
          <div className="rounded-xl bg-yellow-100 p-4 text-sm text-yellow-800">Требуется ручная проверка.</div>
        )}

        {/* QR iframe */}
        {pending.paymentUrl ? (
          <div className="stitch-card overflow-hidden p-0">
            <iframe
              title="Страница оплаты"
              src={pending.paymentUrl}
              className="w-full border-0 sm:min-h-[560px]"
              style={{ minHeight: "400px" }}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="stitch-card p-6 text-sm text-on-surface-variant">Платежная ссылка недоступна.</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {pending.paymentUrl && (
            <a href={pending.paymentUrl} target="_blank" rel="noreferrer" className="stitch-button text-sm">
              Открыть в новом окне
            </a>
          )}
          <button type="button" className="stitch-button-secondary text-sm" onClick={() => router.push("/orders")}>
            Мои заказы
          </button>
        </div>
      </div>
    </AppShell>
  );
}
