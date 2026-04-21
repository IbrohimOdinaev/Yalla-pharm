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
import { Button, Icon } from "@/shared/ui";

export default function PaymentAwaitPage() {
  return (
    <Suspense fallback={<AppShell hideFooter top={<TopBar title="Ожидание оплаты" backHref="back" />}><div className="stitch-card p-6 text-sm">Загрузка...</div></AppShell>}>
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

  const liveState = usePaymentIntentLiveState(paymentIntentId || null, token);

  useEffect(() => {
    const intentState = liveState.data?.paymentIntent?.state;
    if (intentState === 2 || intentState === 3 || intentState === 4) {
      router.push("/orders");
    }
  }, [liveState, router]);

  if (!orderId && !paymentIntentId) {
    return (
      <AppShell hideFooter top={<TopBar title="Ожидание оплаты" backHref="back" />}>
        <div className="rounded-3xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          Сессия ожидания оплаты не найдена.
        </div>
      </AppShell>
    );
  }

  const amount = order?.cost ?? 0;
  const currency = order?.currency ?? "TJS";
  const paymentUrl = order?.paymentUrl;
  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft !== null ? secondsLeft % 60 : null;
  const progress = secondsLeft !== null && order?.paymentExpiresAtUtc
    ? Math.max(0, Math.min(100, (secondsLeft / (24 * 60 * 60)) * 100))
    : null;

  return (
    <AppShell hideFooter top={<TopBar title="Ожидание оплаты" backHref="back" />}>
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Hero with timer */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-container p-6 text-white shadow-card">
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Icon name="clock" size={20} />
              </span>
              <p className="text-xs font-bold uppercase tracking-wider opacity-90">Оплата заказа</p>
            </div>
            <h1 className="font-display text-2xl font-extrabold">Ожидаем оплату</h1>
            <p className="mt-1 text-sm opacity-90">
              Заказ #{orderId.slice(0, 8)}
              {amount > 0 ? ` · ${formatMoney(amount, currency)}` : ""}
            </p>

            {secondsLeft !== null && secondsLeft > 0 ? (
              <>
                <p className="mt-4 font-display text-4xl font-extrabold tabular-nums">
                  {mins}:{String(secs).padStart(2, "0")}
                </p>
                {progress !== null ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                  </div>
                ) : null}
              </>
            ) : secondsLeft === 0 ? (
              <p className="mt-3 text-sm font-bold">Время истекло</p>
            ) : null}
          </div>
        </section>

        {/* Iframe / Payment UI */}
        {paymentUrl ? (
          <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-card">
            <iframe
              title="Страница оплаты"
              src={paymentUrl}
              className="w-full border-0"
              style={{ minHeight: "520px" }}
              loading="lazy"
            />
          </section>
        ) : (
          <section className="rounded-3xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="clock" size={22} />
            </span>
            Загрузка данных оплаты...
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {paymentUrl ? (
            <a href={paymentUrl} target="_blank" rel="noreferrer" className="flex-1">
              <Button size="md" fullWidth rightIcon="arrow-right">Открыть в новом окне</Button>
            </a>
          ) : null}
          <Button variant="secondary" size="md" fullWidth leftIcon="orders" onClick={() => router.push("/orders")}>
            Мои заказы
          </Button>
        </div>

        <p className="text-center text-[11px] text-on-surface-variant">
          Мы автоматически обновим страницу, как только оплата подтвердится.
        </p>
      </div>
    </AppShell>
  );
}
