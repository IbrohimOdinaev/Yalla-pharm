"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney } from "@/shared/lib/format";
import { getOrderById } from "@/entities/order/api";
import { usePaymentIntentLiveState } from "@/features/checkout/model/usePaymentIntentLiveState";
import type { ApiOrder } from "@/shared/types/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function PaymentAwaitPage() {
  return (
    <Suspense fallback={<AppShell top={<TopBar title="Ожидание оплаты" backHref="back" />}><div className="stitch-card p-6 text-sm">Загрузка...</div></AppShell>}>
      <PaymentAwaitContent />
    </Suspense>
  );
}

function PaymentAwaitContent() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId") ?? "";
  const paymentIntentId = searchParams.get("paymentIntentId") ?? "";

  const [order, setOrder] = useState<ApiOrder | null>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    getOrderById(token, orderId).then(setOrder).catch(() => undefined);
  }, [token, orderId]);

  // Countdown from order payment expiry
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    const expiresAt = order?.paymentExpiresAtUtc;
    if (!expiresAt) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [order?.paymentExpiresAtUtc]);

  // Live state polling
  const liveState = usePaymentIntentLiveState(paymentIntentId || null, token);

  useEffect(() => {
    const intentState = liveState.data?.paymentIntent?.state;
    if (intentState === 2 || intentState === 3 || intentState === 4) {
      router.push("/orders");
    }
  }, [liveState, router]);

  if (!orderId && !paymentIntentId) {
    return (
      <AppShell top={<TopBar title="Ожидание оплаты" backHref="back" />}>
        <div className="stitch-card p-6 text-sm text-on-surface-variant">Сессия ожидания оплаты не найдена.</div>
      </AppShell>
    );
  }

  const amount = order?.cost ?? 0;
  const currency = order?.currency ?? "TJS";
  const paymentUrl = order?.paymentUrl;
  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft !== null ? secondsLeft % 60 : null;

  return (
    <AppShell top={<TopBar title="Ожидание оплаты" backHref="back" />}>
      <div className="space-y-5">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-[#0070eb] p-3 xs:p-4 sm:p-6 text-white space-y-2 xs:space-y-3">
          <p className="text-[10px] xs:text-xs font-bold uppercase tracking-wider opacity-80">Оплата заказа</p>
          <h1 className="text-lg xs:text-xl sm:text-2xl font-extrabold">Ожидаем подтверждение</h1>
          <p className="text-sm opacity-80">
            Заказ #{orderId.slice(0, 8)} {amount > 0 ? <>&middot; {formatMoney(amount, currency)}</> : null}
          </p>
          {secondsLeft !== null && secondsLeft > 0 ? (
            <p className="text-lg font-bold">Осталось: {mins}:{String(secs).padStart(2, "0")}</p>
          ) : secondsLeft === 0 ? (
            <p className="text-sm opacity-80">Время истекло</p>
          ) : null}
        </div>

        {/* QR iframe */}
        {paymentUrl ? (
          <div className="stitch-card overflow-hidden p-0">
            <iframe
              title="Страница оплаты"
              src={paymentUrl}
              className="w-full border-0 sm:min-h-[560px]"
              style={{ minHeight: "400px" }}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="stitch-card p-6 text-sm text-on-surface-variant">Загрузка данных оплаты...</div>
        )}

        {/* Actions */}
        <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
          {paymentUrl && (
            <a href={paymentUrl} target="_blank" rel="noreferrer" className="stitch-button text-xs xs:text-sm">
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
