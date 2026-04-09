"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClientOrderHistory, cancelOrder, getOrderById } from "@/entities/order/api";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import type { ApiOrder } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
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

/** Is order awaiting payment confirmation? (only if not already cancelled/delivered/returned) */
function isAwaitingPayment(order: ApiOrder): boolean {
  const terminal = new Set(["Cancelled", "Delivered", "Returned"]);
  if (terminal.has(order.status)) return false;
  return order.paymentState === "PendingManualConfirmation" || order.paymentState === "1";
}

type Tab = "active" | "history";

const ACTIVE_STATUSES = new Set(["New", "UnderReview", "Preparing", "Ready", "OnTheWay"]);
const HISTORY_STATUSES = new Set(["Delivered", "Cancelled", "Returned"]);

function isActiveOrder(order: ApiOrder): boolean {
  // Orders awaiting payment are active unless already in terminal status
  if (HISTORY_STATUSES.has(order.status)) return false;
  return ACTIVE_STATUSES.has(order.status) || isAwaitingPayment(order);
}

export default function OrdersPage() {
  const token = useAppSelector((state) => state.auth.token);
  const addCartItem = useCartStore((s) => s.addItem);
  const addGuestItem = useGuestCartStore((s) => s.addItem);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, ApiOrder>>({});
  const [pharmacyMap, setPharmacyMap] = useState<Record<string, ActivePharmacy>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("active");

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

  useEffect(() => { loadAll(); }, [loadAll]);

  // Track which orders we've already returned to cart (prevent duplicates)
  const returnedOrderIds = useRef(new Set<string>());

  // Listen for real-time order status changes (e.g. auto-cancel after 24h)
  useOrderStatusLive(useCallback(async (payload) => {
    if (payload.status === "Cancelled" && token && !returnedOrderIds.current.has(payload.orderId)) {
      returnedOrderIds.current.add(payload.orderId);
      try {
        const detail = await getOrderById(token, payload.orderId);
        const positions = (detail.positions ?? []).filter((p) => !p.isRejected && p.medicineId && p.quantity > 0);
        for (const pos of positions) {
          try { await addCartItem(token, pos.medicineId, pos.quantity); } catch { /* best effort */ }
        }
      } catch { /* skip */ }
    }
    // Refresh orders list
    loadAll();
  }, [token, loadAll, addCartItem]));

  // Auto-switch to history tab if no active orders
  const hasActive = orders.some((o) => isActiveOrder(orderDetails[o.orderId] ?? o));
  useEffect(() => {
    if (!isLoading && !hasActive && orders.length > 0) {
      setActiveTab("history");
    }
  }, [isLoading, hasActive, orders.length]);

  /** Return non-rejected positions back to cart */
  async function returnPositionsToCart(order: ApiOrder) {
    const positions = (order.positions ?? []).filter((p) => !p.isRejected && p.medicineId && p.quantity > 0);
    for (const pos of positions) {
      try {
        if (token) {
          await addCartItem(token, pos.medicineId, pos.quantity);
        } else {
          addGuestItem(pos.medicineId, pos.quantity);
        }
      } catch { /* best effort */ }
    }
  }

  async function onCancel(orderId: string) {
    if (!token) return;
    if (!confirm("Отменить этот заказ? Позиции будут возвращены в корзину.")) return;
    setCancellingId(orderId);
    try {
      // Get full order details before cancelling (need positions)
      const detail = orderDetails[orderId] ?? await getOrderById(token, orderId);
      await cancelOrder(token, orderId);
      await returnPositionsToCart(detail);
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
      <AppShell top={<TopBar title="Заказы" backHref="back" />}>
        <div className="stitch-card p-5 xs:p-6 sm:p-8 text-center space-y-3 xs:space-y-4">
          <div className="mx-auto w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          </div>
          <h2 className="text-sm xs:text-base sm:text-lg font-bold">Требуется авторизация</h2>
          <p className="text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Войдите по SMS, чтобы увидеть ваши заказы</p>
          <div className="flex justify-center gap-2 xs:gap-3">
            <Link href="/login" className="stitch-button text-[10px] xs:text-xs sm:text-sm">Войти по SMS</Link>
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

  const activeOrders = sortedOrders.filter((o) => isActiveOrder(orderDetails[o.orderId] ?? o));
  const historyOrders = sortedOrders.filter((o) => !isActiveOrder(orderDetails[o.orderId] ?? o));
  const displayedOrders = activeTab === "active" ? activeOrders : historyOrders;

  return (
    <AppShell top={<TopBar title="Мои заказы" backHref="back" />}>
      <div className="space-y-2 xs:space-y-3">
        {isLoading ? <div className="stitch-card p-4 xs:p-5 sm:p-6 text-[10px] xs:text-xs sm:text-sm">Загрузка...</div> : null}
        {error ? <div className="rounded-xl bg-red-100 p-2 xs:p-3 text-[10px] xs:text-xs sm:text-sm text-red-700">{error}</div> : null}

        {/* Tabs */}
        {!isLoading && sortedOrders.length > 0 ? (
          <div className="flex gap-1.5 xs:gap-2 rounded-xl bg-surface-container-low p-1 xs:p-1.5">
            <button
              type="button"
              className={`flex-1 rounded-lg px-2 xs:px-3 py-1.5 xs:py-2 text-[10px] xs:text-xs sm:text-sm font-bold transition ${
                activeTab === "active"
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
              onClick={() => setActiveTab("active")}
            >
              Активные{activeOrders.length > 0 ? ` (${activeOrders.length})` : ""}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-2 xs:px-3 py-1.5 xs:py-2 text-[10px] xs:text-xs sm:text-sm font-bold transition ${
                activeTab === "history"
                  ? "bg-surface-container-high text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
              onClick={() => setActiveTab("history")}
            >
              История{historyOrders.length > 0 ? ` (${historyOrders.length})` : ""}
            </button>
          </div>
        ) : null}

        {!isLoading && sortedOrders.length === 0 ? (
          <div className="stitch-card flex flex-col items-center gap-2 xs:gap-3 p-6 xs:p-8 sm:p-10 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 xs:h-12 xs:w-12 text-on-surface-variant opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3.75h15A2.25 2.25 0 0021.75 16.5V7.5a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[10px] xs:text-xs sm:text-sm font-medium text-on-surface-variant">У вас ещё нет заказов</p>
            <Link href="/" className="text-[10px] xs:text-xs sm:text-sm font-bold text-primary">Перейти в каталог</Link>
          </div>
        ) : null}

        {/* Empty tab state */}
        {!isLoading && sortedOrders.length > 0 && displayedOrders.length === 0 ? (
          <div className="stitch-card p-5 xs:p-6 text-center text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">
            {activeTab === "active" ? "Нет активных заказов" : "История заказов пуста"}
          </div>
        ) : null}

        {/* Orders list */}
        {displayedOrders.map((order) => {
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
                className="flex w-full items-center justify-between p-2.5 xs:p-3 sm:p-4 text-left"
                onClick={() => onToggleExpand(order.orderId)}
              >
                <div className="space-y-0.5 xs:space-y-1">
                  <p className="font-mono text-[10px] text-on-surface-variant">#{order.orderId.slice(0, 8)}</p>
                  <div className="flex items-center gap-1 xs:gap-1.5">
                    <p className="text-xs xs:text-sm sm:text-lg font-extrabold text-primary">{cost > 0 ? formatMoney(cost, d.currency) : "—"}</p>
                    {returnCost > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 xs:px-2 py-0.5 text-[10px] font-bold text-red-700">возврат {formatMoney(returnCost, d.currency)}</span>
                    ) : null}
                  </div>
                  {pharmacy ? <p className="text-[10px] xs:text-xs sm:text-sm font-medium">{pharmacy.title}</p> : null}
                  {order.createdAtUtc ? (
                    <p className="text-[10px] xs:text-xs text-on-surface-variant">
                      {new Date(order.createdAtUtc).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 xs:gap-1.5 flex-shrink-0">
                  <span className={`rounded-full px-1.5 xs:px-2 py-0.5 text-[8px] xs:text-[10px] sm:text-xs font-bold ${statusColor}`}>{statusLabel}</span>
                  <span className="text-on-surface-variant text-[10px] xs:text-xs sm:text-sm">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Payment button + warning for awaiting orders */}
              {awaiting ? (
                <div className="flex items-center gap-2 px-2.5 xs:px-3 sm:px-4 pb-2 xs:pb-2.5">
                  {d.paymentUrl ? (
                    <a
                      href={d.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="stitch-button text-center text-[10px] xs:text-xs px-3 xs:px-4 py-1.5 flex-shrink-0"
                    >
                      Оплатить
                    </a>
                  ) : null}
                  <p className="text-[9px] xs:text-[10px] text-amber-600 leading-tight">
                    Оплатите в течение 24ч, иначе заказ будет отменён
                  </p>
                </div>
              ) : null}

              {isExpanded ? (() => {
                const positions = d.positions ?? [];
                const detailCost = cost;
                const detailReturnCost = returnCost;

                return (
                  <div className="border-t border-surface-container-high px-1.5 xs:px-3 sm:px-4 pb-2 xs:pb-4 pt-1.5 xs:pt-3 space-y-2 xs:space-y-3">
                    {/* Order info */}
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5 xs:gap-2 text-[10px] xs:text-xs sm:text-sm">
                      {pharmacy ? (
                        <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                          <p className="text-[10px] text-on-surface-variant uppercase">Аптека</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold">{pharmacy.title}</p>
                          {pharmacy.address ? <p className="text-[10px] text-on-surface-variant">{pharmacy.address}</p> : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase">Доставка</p>
                        <p className="text-[10px] xs:text-xs sm:text-sm font-bold">{order.isPickup ? "Самовывоз" : order.deliveryAddress || "—"}</p>
                        {!order.isPickup && (d as ApiOrder & { deliveryCost?: number }).deliveryCost ? (
                          <p className="text-[10px] text-on-surface-variant">Стоимость: {formatMoney((d as ApiOrder & { deliveryCost?: number }).deliveryCost!, d.currency)}</p>
                        ) : null}
                        {!order.isPickup && (d as ApiOrder & { driverName?: string }).driverName ? (
                          <p className="text-[10px] text-emerald-600">Водитель: {(d as ApiOrder & { driverName?: string }).driverName}{(d as ApiOrder & { driverPhone?: string }).driverPhone ? ` (${(d as ApiOrder & { driverPhone?: string }).driverPhone})` : ""}</p>
                        ) : null}
                      </div>
                      <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase">Сумма</p>
                        <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-primary">{detailCost > 0 ? formatMoney(detailCost, d.currency) : "—"}</p>
                      </div>
                      {detailReturnCost > 0 ? (
                        <div className="rounded-xl bg-red-50 p-2 xs:p-2.5">
                          <p className="text-[10px] text-red-600 uppercase">Возврат</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-red-700">{formatMoney(detailReturnCost, d.currency)}</p>
                        </div>
                      ) : null}
                      {(d.paymentState) ? (
                        <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                          <p className="text-[10px] text-on-surface-variant uppercase">Оплата</p>
                          <p className={`text-[10px] xs:text-xs sm:text-sm font-bold ${d.paymentState === "Confirmed" ? "text-emerald-600" : d.paymentState === "Expired" ? "text-red-600" : "text-yellow-600"}`}>
                            {d.paymentState === "Confirmed" ? "Подтверждена" : d.paymentState === "Expired" ? "Не оплачен" : "Ожидает"}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Positions as mini-cards */}
                    {positions.length > 0 ? (
                      <div className="space-y-1.5 xs:space-y-2">
                        <p className="text-[10px] xs:text-xs font-bold uppercase tracking-wider text-on-surface-variant">Позиции ({positions.length})</p>
                        {positions.map((pos) => (
                          <Link
                            key={pos.positionId}
                            href={pos.medicineId ? `/product/${pos.medicineId}` : "#"}
                            className="flex items-center gap-2 xs:gap-3 rounded-xl bg-surface-container-low p-2 xs:p-3 transition hover:bg-surface-container-high"
                          >
                            <div className="h-9 w-9 xs:h-10 xs:w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-lg bg-surface-container overflow-hidden">
                              {pos.medicine?.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={`${env.apiBaseUrl}/api/medicines/images/${(pos.medicine.images[0] as { id: string }).id}/content`} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] xs:text-xs sm:text-sm font-bold text-on-surface-variant/40">
                                  {(pos.medicine?.title ?? "?")[0]}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] xs:text-xs sm:text-sm font-bold truncate">{pos.medicine?.title ?? "Товар"}</p>
                              {pos.quantity > 0 ? (
                                <div className="flex items-center gap-1 text-[10px] xs:text-xs text-on-surface-variant">
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
                      <p className="text-[10px] xs:text-xs text-on-surface-variant">Загрузка позиций...</p>
                    )}

                    {/* Refund info */}
                    {order.refundRequest ? (
                      <div className="rounded-xl bg-yellow-50 p-2 xs:p-3 text-[10px] xs:text-xs sm:text-sm">
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
                        className="w-full rounded-xl bg-red-100 px-3 xs:px-4 py-2 xs:py-3 text-[10px] xs:text-xs sm:text-sm font-bold text-red-700"
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
