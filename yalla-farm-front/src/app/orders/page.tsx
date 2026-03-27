"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getClientOrderHistory, cancelOrder, getOrderById } from "@/entities/order/api";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import type { ApiOrder } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { env } from "@/shared/config/env";

const STATUS_LABELS: Record<string, string> = {
  New: "Новый",
  UnderReview: "На рассмотрении",
  Preparing: "Собирается",
  Ready: "Готов к выдаче",
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
  OnTheWay: "bg-purple-100 text-purple-800",
  Delivered: "bg-emerald-100 text-emerald-800",
  Returned: "bg-gray-100 text-gray-600",
  Cancelled: "bg-red-100 text-red-700"
};

const CANCELLABLE = new Set(["UnderReview", "Preparing", "Ready"]);

/** Compute cost from positions when backend cost is 0 */
function getOrderCost(order: ApiOrder): number {
  if ((order.cost ?? 0) > 0) return order.cost!;
  return (order.positions ?? [])
    .filter((p) => !p.isRejected)
    .reduce((sum, p) => sum + (p.price ?? 0) * (p.quantity ?? 0), 0);
}

/** Compute return cost from rejected positions */
function computeReturnCost(order: ApiOrder): number {
  return (order.positions ?? [])
    .filter((p) => p.isRejected)
    .reduce((sum, p) => sum + (p.price ?? 0) * (p.quantity ?? 0), 0);
}

/** Is order awaiting payment confirmation? */
function isAwaitingPayment(order: ApiOrder): boolean {
  return order.paymentState === "PendingManualConfirmation" || order.paymentState === "1";
}

export default function OrdersPage() {
  const token = useAppSelector((state) => state.auth.token);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, ApiOrder>>({});
  const [pharmacyMap, setPharmacyMap] = useState<Record<string, ActivePharmacy>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Pending payment from localStorage
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

  // Clear pending when matching order appears
  useEffect(() => {
    if (orders.length === 0) return;
    try {
      const raw = localStorage.getItem("yalla.front.pending.payment.intent");
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (pending.reservedOrderId && orders.some(o => o.orderId === pending.reservedOrderId)) {
        localStorage.removeItem("yalla.front.pending.payment.intent");
        setPendingPayment(null);
      }
    } catch { /* ignore */ }
  }, [orders]);

  // Load order list + details for each + pharmacies
  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [history, pharmacies] = await Promise.all([
        getClientOrderHistory(token),
        getActivePharmacies(token).catch(() => [] as ActivePharmacy[]),
      ]);
      setOrders(history);
      const pMap: Record<string, ActivePharmacy> = {};
      for (const p of pharmacies) pMap[p.id] = p;
      setPharmacyMap(pMap);
      // Load full details for each order (positions with prices)
      const details: Record<string, ApiOrder> = {};
      await Promise.all(history.map(async (o) => {
        try { details[o.orderId] = await getOrderById(token, o.orderId); } catch { /* skip */ }
      }));
      setOrderDetails(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить заказы.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useOrderStatusLive(useCallback(() => { loadAll(); }, [loadAll]));
  useSignalREvent("PaymentIntentUpdated", useCallback(() => { loadAll(); }, [loadAll]), token);

  useEffect(() => { loadAll(); }, [loadAll]);

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

  function onToggleExpand(orderId: string) {
    if (expandedId === orderId) { setExpandedId(null); return; }
    setExpandedId(orderId);
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

  // Sort by date descending (newest first)
  const sortedOrders = [...orders].sort((a, b) => {
    const da = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0;
    const db = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0;
    return db - da;
  });

  return (
    <AppShell top={<TopBar title="Мои заказы" backHref="/" />}>
      <div className="space-y-3">
        {isLoading ? <div className="stitch-card p-6 text-sm">Загрузка...</div> : null}
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {/* Pending payment (PaymentIntent not yet confirmed by admin) */}
        {pendingPayment ? (
          <div className="stitch-card space-y-3 p-5 ring-2 ring-yellow-400">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">Ожидает подтверждения</span>
              <span className="font-bold">{formatMoney(pendingPayment.amount, pendingPayment.currency)}</span>
            </div>
            <p className="text-xs text-on-surface-variant">Заказ #{pendingPayment.reservedOrderId.slice(0, 8)}</p>
            <Link href="/payment-await" className="stitch-button-secondary text-sm inline-block">Статус оплаты</Link>
          </div>
        ) : null}

        {!isLoading && sortedOrders.length === 0 && !pendingPayment ? (
          <div className="stitch-card flex flex-col items-center gap-3 p-10 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-on-surface-variant opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3.75h15A2.25 2.25 0 0021.75 16.5V7.5a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm font-medium text-on-surface-variant">У вас ещё нет заказов</p>
            <Link href="/" className="text-sm font-bold text-primary">Перейти в каталог</Link>
          </div>
        ) : null}

        {/* Orders list — sorted by date, no filters */}
        {sortedOrders.map((order) => {
          const isExpanded = expandedId === order.orderId;
          const detail = orderDetails[order.orderId];
          const awaiting = isAwaitingPayment(detail ?? order);
          const statusColor = awaiting ? "bg-yellow-100 text-yellow-800" : (STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600");
          const statusLabel = awaiting ? "Ожидает подтверждения" : (STATUS_LABELS[order.status] ?? order.status);
          const d = detail ?? order;
          const cost = getOrderCost(d);
          const returnCost = (d.returnCost ?? 0) > 0 ? d.returnCost! : computeReturnCost(d);
          const pharmacy = pharmacyMap[d.pharmacyId ?? ""];

          return (
            <article key={order.orderId} className="stitch-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() => onToggleExpand(order.orderId)}
              >
                <div className="space-y-1">
                  <p className="font-mono text-[10px] text-on-surface-variant">#{order.orderId.slice(0, 8)}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-extrabold text-primary">{cost > 0 ? formatMoney(cost, d.currency) : "—"}</p>
                    {returnCost > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">возврат {formatMoney(returnCost, d.currency)}</span>
                    ) : null}
                  </div>
                  {pharmacy ? <p className="text-sm font-medium">{pharmacy.title}</p> : null}
                  {order.createdAtUtc ? (
                    <p className="text-xs text-on-surface-variant">
                      {new Date(order.createdAtUtc).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>{statusLabel}</span>
                  <span className="text-on-surface-variant text-sm">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded ? (() => {
                const positions = d.positions ?? [];
                const detailCost = cost;
                const detailReturnCost = returnCost;

                return (
                  <div className="border-t border-surface-container-high px-4 pb-4 pt-3 space-y-4">
                    {/* Order info */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {pharmacy ? (
                        <div className="rounded-xl bg-surface-container-low p-2.5">
                          <p className="text-[10px] text-on-surface-variant uppercase">Аптека</p>
                          <p className="font-bold">{pharmacy.title}</p>
                          {pharmacy.address ? <p className="text-[10px] text-on-surface-variant">{pharmacy.address}</p> : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-surface-container-low p-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase">Доставка</p>
                        <p className="font-bold">{order.isPickup ? "Самовывоз" : order.deliveryAddress || "—"}</p>
                      </div>
                      <div className="rounded-xl bg-surface-container-low p-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase">Сумма</p>
                        <p className="font-bold text-primary">{detailCost > 0 ? formatMoney(detailCost, d.currency) : "—"}</p>
                      </div>
                      {detailReturnCost > 0 ? (
                        <div className="rounded-xl bg-red-50 p-2.5">
                          <p className="text-[10px] text-red-600 uppercase">Возврат</p>
                          <p className="font-bold text-red-700">{formatMoney(detailReturnCost, d.currency)}</p>
                        </div>
                      ) : null}
                      {(d.paymentState) ? (
                        <div className="rounded-xl bg-surface-container-low p-2.5">
                          <p className="text-[10px] text-on-surface-variant uppercase">Оплата</p>
                          <p className={`font-bold ${d.paymentState === "Confirmed" ? "text-emerald-600" : "text-yellow-600"}`}>
                            {d.paymentState === "Confirmed" ? "Подтверждена" : "Ожидает"}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Positions as mini-cards */}
                    {positions.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Позиции ({positions.length})</p>
                        {positions.map((pos) => (
                          <Link
                            key={pos.positionId}
                            href={pos.medicineId ? `/product/${pos.medicineId}` : "#"}
                            className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 transition hover:bg-surface-container-high"
                          >
                            <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-surface-container overflow-hidden">
                              {pos.medicine?.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={`${env.apiBaseUrl}/api/medicines/images/${(pos.medicine.images[0] as { id: string }).id}/content`} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-on-surface-variant/40">
                                  {(pos.medicine?.title ?? "?")[0]}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{pos.medicine?.title ?? "Товар"}</p>
                              {pos.quantity > 0 ? (
                                <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                                  <span>{pos.quantity} шт.</span>
                                  {pos.price > 0 ? (
                                    <>
                                      <span>&times;</span>
                                      <span className="font-bold text-primary">{formatMoney(pos.price)}</span>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {pos.isRejected ? (
                              <span className="flex-shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Отклонено</span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant">Загрузка позиций...</p>
                    )}

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
                        className="w-full rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700"
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
        })}
      </div>
    </AppShell>
  );
}
