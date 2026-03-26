"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getClientOrderHistory, cancelOrder, getOrderById } from "@/entities/order/api";
import type { ApiOrder } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { env } from "@/shared/config/env";

const STATUS_LABELS: Record<string, string> = {
  New: "Новый",
  UnderReview: "На рассмотрении",
  Preparing: "Собирается",
  Ready: "Готов",
  OnTheWay: "В пути",
  Delivered: "Доставлен",
  Returned: "Возврат",
  Cancelled: "Отменён"
};

const STATUS_COLORS: Record<string, string> = {
  New: "bg-yellow-100 text-yellow-800",
  UnderReview: "bg-blue-100 text-blue-800",
  Preparing: "bg-blue-100 text-blue-800",
  Ready: "bg-emerald-100 text-emerald-800",
  OnTheWay: "bg-emerald-100 text-emerald-800",
  Delivered: "bg-emerald-100 text-emerald-800",
  Returned: "bg-gray-100 text-gray-600",
  Cancelled: "bg-red-100 text-red-700"
};

const CANCELLABLE = new Set(["New", "UnderReview"]);

const ACTIVE_STATUSES = new Set(["New", "UnderReview", "Preparing", "Ready", "OnTheWay"]);
const COMPLETED_STATUSES = new Set(["Delivered"]);
const CANCELLED_STATUSES = new Set(["Cancelled", "Returned"]);

export default function OrdersPage() {
  const token = useAppSelector((state) => state.auth.token);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, ApiOrder>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Read pending payment from localStorage
  const [pendingPayment, setPendingPayment] = useState<{
    paymentIntentId: string; reservedOrderId: string; paymentUrl: string;
    amount: number; currency: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("yalla.front.pending.payment.intent");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.paymentIntentId) setPendingPayment(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (orders.length === 0) return;
    try {
      const raw = localStorage.getItem("yalla.front.pending.payment.intent");
      if (!raw) return;
      const pending = JSON.parse(raw);
      const reservedId = pending.reservedOrderId;
      if (reservedId && orders.some(o => o.orderId === reservedId)) {
        localStorage.removeItem("yalla.front.pending.payment.intent");
        setPendingPayment(null);
      }
    } catch { /* ignore */ }
  }, [orders]);

  useOrderStatusLive(useCallback(() => {
    if (token) {
      getClientOrderHistory(token).then(setOrders).catch(() => undefined);
    }
  }, [token]));

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getClientOrderHistory(token)
      .then((data) => {
        setOrders(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить заказы.");
        setIsLoading(false);
      });
  }, [token]);

  async function onCancel(orderId: string) {
    if (!token) return;
    if (!confirm("Отменить этот заказ? Будет создан запрос на возврат.")) return;
    setCancellingId(orderId);
    try {
      await cancelOrder(token, orderId);
      const updated = await getClientOrderHistory(token);
      setOrders(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить заказ.");
    } finally {
      setCancellingId(null);
    }
  }

  if (!token) {
    return (
      <AppShell top={<TopBar title="Заказы" backHref="/" />}>
        <div className="stitch-card p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold">Требуется авторизация</h2>
          <p className="text-sm text-on-surface-variant">Войдите или зарегистрируйтесь для доступа</p>
          <div className="flex justify-center gap-3">
            <Link href="/login" className="stitch-button text-sm">Войти</Link>
            <Link href="/register" className="stitch-button-secondary text-sm">Регистрация</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Мои заказы" backHref="/" />}>
      <div className="space-y-4">
        {/* Status filter */}
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: "all", label: "Все" },
            { id: "active", label: "В процессе" },
            { id: "completed", label: "Выполнены" },
            { id: "cancelled", label: "Отменены" }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        {isLoading ? <div className="stitch-card p-6 text-sm">Загрузка...</div> : null}
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {/* Pending payment (PaymentIntent not yet confirmed) */}
        {pendingPayment ? (
          <div className="stitch-card space-y-3 p-5 ring-2 ring-yellow-400">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">Ожидает оплату</span>
            </div>
            <p className="text-sm">Заказ #{pendingPayment.reservedOrderId.slice(0, 8)} · {formatMoney(pendingPayment.amount, pendingPayment.currency)}</p>
            <div className="flex gap-2">
              {pendingPayment.paymentUrl ? (
                <a href={pendingPayment.paymentUrl} className="stitch-button text-sm" target="_blank" rel="noreferrer">
                  Оплатить
                </a>
              ) : null}
              <Link href="/payment-await" className="stitch-button-secondary text-sm">Статус оплаты</Link>
              <button type="button" className="text-xs text-on-surface-variant hover:text-red-600" onClick={() => {
                localStorage.removeItem("yalla.front.pending.payment.intent");
                setPendingPayment(null);
              }}>Отменить</button>
            </div>
          </div>
        ) : null}

        {!isLoading && orders.length === 0 && !pendingPayment ? (
          <div className="stitch-card flex flex-col items-center gap-3 p-10 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-on-surface-variant opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3.75h15A2.25 2.25 0 0021.75 16.5V7.5a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm font-medium text-on-surface-variant">У вас ещё нет заказов</p>
            <Link href="/" className="text-sm font-bold text-primary">Перейти в каталог</Link>
          </div>
        ) : null}

        {(() => {
          const filteredOrders = orders.filter((o) => {
            if (filter === "active") return ACTIVE_STATUSES.has(o.status);
            if (filter === "completed") return COMPLETED_STATUSES.has(o.status);
            if (filter === "cancelled") return CANCELLED_STATUSES.has(o.status);
            return true;
          });

          if (!isLoading && orders.length > 0 && filteredOrders.length === 0) {
            return (
              <div className="stitch-card flex flex-col items-center gap-3 p-10 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-on-surface-variant opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <p className="text-sm font-medium text-on-surface-variant">Нет заказов с таким статусом</p>
              </div>
            );
          }

          return filteredOrders.map((order) => {
          const isExpanded = expandedId === order.orderId;
          const statusColor = STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600";
          const statusLabel = STATUS_LABELS[order.status] ?? order.status;

          return (
            <article key={order.orderId} className="stitch-card overflow-hidden">
              {/* Header - always visible */}
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() => {
                  if (isExpanded) { setExpandedId(null); return; }
                  setExpandedId(order.orderId);
                  if (!orderDetails[order.orderId] && token) {
                    getOrderById(token, order.orderId)
                      .then(detail => setOrderDetails(prev => ({ ...prev, [order.orderId]: detail })))
                      .catch(() => undefined);
                  }
                }}
              >
                <div className="space-y-1">
                  <p className="font-mono text-xs text-on-surface-variant">#{order.orderId.slice(0, 8)}</p>
                  <p className="font-bold">{formatMoney(order.cost, order.currency)}</p>
                  {order.createdAtUtc ? (
                    <p className="text-xs text-on-surface-variant">
                      {new Date(order.createdAtUtc).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>{statusLabel}</span>
                  <span className="text-on-surface-variant">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded ? (() => {
                const detail = orderDetails[order.orderId];
                const detailPositions = detail?.positions ?? order.positions ?? [];
                const pharmacyLabel = detail?.pharmacyTitle ?? order.pharmacyTitle ?? (detail?.pharmacyId ? detail.pharmacyId.slice(0, 8) : null);
                const paymentState = detail?.paymentState ?? order.paymentState;
                return (
                <div className="border-t border-surface-container-high px-4 pb-4 pt-3 space-y-3">
                  <div className="space-y-1 text-sm">
                    {pharmacyLabel ? (
                      <p><span className="text-on-surface-variant">Аптека:</span> {pharmacyLabel}</p>
                    ) : null}
                    <p>
                      <span className="text-on-surface-variant">Доставка:</span>{" "}
                      {order.isPickup ? "Самовывоз" : order.deliveryAddress ?? "—"}
                    </p>
                    {paymentState ? (
                      <p>
                        <span className="text-on-surface-variant">Оплата:</span>{" "}
                        <span className={paymentState === "Confirmed" ? "text-emerald-700 font-bold" : "text-yellow-700 font-bold"}>
                          {paymentState === "Confirmed" ? "Подтверждена" : paymentState === "PendingManualConfirmation" ? "Ожидает" : paymentState}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {/* Positions as mini-cards */}
                  {detailPositions.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Позиции</p>
                      {detailPositions.map((pos) => (
                        <Link
                          key={pos.positionId}
                          href={pos.medicineId ? `/product/${pos.medicineId}` : "#"}
                          className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 transition hover:bg-surface-container-high"
                        >
                          <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-surface-container overflow-hidden">
                            {pos.medicine?.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`${env.apiBaseUrl}/api/medicines/images/${pos.medicine.images[0].id}/content`} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-on-surface-variant">
                                {(pos.medicine?.title ?? "?")[0]}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{pos.medicine?.title ?? pos.medicineId?.slice(0, 8) ?? "Товар"}</p>
                            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                              <span>{pos.quantity} шт.</span>
                              <span>&times;</span>
                              <span className="font-bold text-primary">{formatMoney(pos.price)}</span>
                            </div>
                          </div>
                          {pos.isRejected ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Отклонено</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {/* Refund info */}
                  {order.refundRequest ? (
                    <div className="rounded-xl bg-yellow-50 p-3 text-sm">
                      <p className="font-bold text-yellow-800">Запрос на возврат</p>
                      <p className="text-yellow-700">
                        Сумма: {formatMoney(order.refundRequest.amount, order.refundRequest.currency)} — Статус: {order.refundRequest.status}
                      </p>
                    </div>
                  ) : null}

                  {/* Cancel button */}
                  {CANCELLABLE.has(order.status) ? (
                    <button
                      type="button"
                      className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-700"
                      onClick={() => onCancel(order.orderId)}
                      disabled={cancellingId === order.orderId}
                    >
                      {cancellingId === order.orderId ? "Отменяем..." : "Отменить заказ"}
                    </button>
                  ) : null}
                </div>
                );
              })() : null}
            </article>
          );
        });
        })()}
      </div>
    </AppShell>
  );
}
