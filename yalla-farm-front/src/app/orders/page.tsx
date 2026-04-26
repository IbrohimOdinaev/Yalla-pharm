"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getClientOrderHistory, cancelOrder, getOrderById, repeatOrder } from "@/entities/order/api";
import {
  computeOriginalPaid as totalsOriginalPaid,
  computeRejectedRefund,
  computeReturnedRefund,
  computeTotalRefund,
  computeNetCost,
} from "@/entities/order/totals";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { usePharmacyAddresses } from "@/features/pharmacy/model/usePharmacyAddresses";
import { getPickupAvailability } from "@/features/pharmacy/model/pharmacyHours";
import type { ApiOrder } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { env } from "@/shared/config/env";
import { Button, Chip, EmptyState, Icon } from "@/shared/ui";
import { OrderStatusBadge } from "@/widgets/order/OrderStatusBadge";

const STATUS_LABELS: Record<string, string> = {
  New: "Новый",
  UnderReview: "На рассмотрении",
  Preparing: "Собирается",
  Ready: "Готов к выдаче",
  OnTheWay: "В пути",
  DriverArrived: "Курьер у вас",
  Delivered: "Доставлен",
  PickedUp: "Забран",
  Returned: "Возврат",
  Cancelled: "Отменён"
};

const CANCELLABLE = new Set(["UnderReview", "Preparing", "Ready"]);

// Subset of JURA status_ids we surface to the client: 4 on-site, 7 in transit, 9 delivered.
function formatJuraDeliveryStatus(statusId: number | null | undefined): string | null {
  switch (statusId) {
    case 4: return "Курьер на месте";
    case 7: return "Курьер везёт заказ";
    case 9: return "Заказ доставлен";
    default: return null;
  }
}

// Show receipt code when our Order is OnTheWay OR JURA is engaged (4/7).
function shouldShowReceiptCode(order: ApiOrder): boolean {
  if (!order.recipientCode) return false;
  if (order.status === "OnTheWay") return true;
  return order.juraStatusId === 4 || order.juraStatusId === 7;
}

// Money helpers for orders extracted to entities/order/totals.ts —
// see imports above (totalsOriginalPaid, computeRejectedRefund, etc.).

/** Is order awaiting payment confirmation? (only if not already cancelled/delivered/returned) */
function isAwaitingPayment(order: ApiOrder): boolean {
  const terminal = new Set(["Cancelled", "Delivered", "PickedUp", "Returned"]);
  if (terminal.has(order.status)) return false;
  return order.paymentState === "PendingManualConfirmation" || order.paymentState === "1";
}

type Tab = "active" | "history";

const ACTIVE_STATUSES = new Set(["New", "UnderReview", "Preparing", "Ready", "OnTheWay"]);
const HISTORY_STATUSES = new Set(["Delivered", "PickedUp", "Cancelled", "Returned"]);

function isActiveOrder(order: ApiOrder): boolean {
  // Orders awaiting payment are active unless already in terminal status
  if (HISTORY_STATUSES.has(order.status)) return false;
  return ACTIVE_STATUSES.has(order.status) || isAwaitingPayment(order);
}

/** Pickup orders that are still in-pharmacy and haven't been handed over yet.
 * For these we compute "забрать сегодня/завтра" each render so the hint stays
 * fresh as the current time crosses the pharmacy's 30-minute cutoff. */
const PICKUP_HINT_STATUSES = new Set(["New", "UnderReview", "Preparing", "Ready"]);

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
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("active");

  // Resolve Plus-Code pharmacy addresses to human-readable Jura text.
  const pharmacyList = Object.values(pharmacyMap);
  const resolvedAddresses = usePharmacyAddresses(pharmacyList);

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

  async function onRepeat(order: ApiOrder) {
    if (!token) return;
    if (!confirm("Повторить заказ? Будет создан новый заказ с теми же позициями. Корзина не изменится.")) return;
    setRepeatingId(order.orderId);
    try {
      const response = await repeatOrder(token, order.orderId, {
        pharmacyId: order.pharmacyId ?? "",
        isPickup: Boolean(order.isPickup),
        deliveryAddress: order.deliveryAddress ?? "",
      });
      const updated = await getClientOrderHistory(token);
      setOrders(updated);
      const paymentUrl = String(response?.paymentUrl ?? "");
      if (paymentUrl) window.location.assign(paymentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось повторить заказ.");
    } finally {
      setRepeatingId(null);
    }
  }

  if (!token) {
    return (
      <AppShell top={<TopBar title="Заказы" backHref="back" />}>
        <EmptyState
          icon="user"
          title="Требуется авторизация"
          description="Войдите по SMS, чтобы увидеть ваши заказы"
          action={
            <Link href="/login">
              <Button size="md" rightIcon="arrow-right">Войти по SMS</Button>
            </Link>
          }
        />
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
          <div className="flex items-center gap-1 rounded-full bg-surface-container-low p-1">
            <button
              type="button"
              className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
                activeTab === "active"
                  ? "bg-primary text-white shadow-card"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              onClick={() => setActiveTab("active")}
            >
              Активные{activeOrders.length > 0 ? ` · ${activeOrders.length}` : ""}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
                activeTab === "history"
                  ? "bg-primary text-white shadow-card"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              onClick={() => setActiveTab("history")}
            >
              История{historyOrders.length > 0 ? ` · ${historyOrders.length}` : ""}
            </button>
          </div>
        ) : null}

        {!isLoading && sortedOrders.length === 0 ? (
          <EmptyState
            icon="orders"
            title="У вас ещё нет заказов"
            description="Оформите первый заказ в каталоге"
            action={
              <Link href="/">
                <Button size="md" rightIcon="arrow-right">Перейти в каталог</Button>
              </Link>
            }
          />
        ) : null}

        {/* Empty tab state */}
        {!isLoading && sortedOrders.length > 0 && displayedOrders.length === 0 ? (
          <div className="rounded-3xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            {activeTab === "active" ? "Нет активных заказов" : "История заказов пуста"}
          </div>
        ) : null}

        {/* Orders list */}
        {displayedOrders.map((order) => {
          const isExpanded = expandedId === order.orderId;
          const detail = orderDetails[order.orderId];
          const awaiting = isAwaitingPayment(detail ?? order);
          // Client sees Returned orders tagged with their original completion mode: "Доставлен · Возврат" / "Забран · Возврат"
          const baseStatusLabel = STATUS_LABELS[order.status] ?? order.status;
          const statusLabel = awaiting
            ? "Ожидает оплаты"
            : order.status === "Returned"
              ? `${order.isPickup ? "Забран" : "Доставлен"} · Возврат`
              : baseStatusLabel;
          const d = detail ?? order;
          const cost = computeNetCost(d);
          const rejectedRefund = computeRejectedRefund(d);
          const returnedRefund = computeReturnedRefund(d);
          const refundAmount = computeTotalRefund(d);
          const originalPaid = totalsOriginalPaid(d);
          const pharmacy = pharmacyMap[d.pharmacyId ?? ""];
          // For active pickup orders, compute "today/tomorrow" hint on every
          // render so the cutoff flip happens live (no stale data). Skipped
          // for delivery orders and for orders already past pickup.
          const pickupHint =
            d.isPickup && PICKUP_HINT_STATUSES.has(order.status) && pharmacy
              ? getPickupAvailability(pharmacy.opensAt, pharmacy.closesAt)
              : null;

          return (
            <article key={order.orderId} className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-card">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
                onClick={() => onToggleExpand(order.orderId)}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/70">#{order.orderId.slice(0, 8)}</p>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-xl font-extrabold text-primary">{originalPaid > 0 ? `${formatMoney(originalPaid)} ${d.currency ?? "TJS"}` : "—"}</p>
                    {refundAmount > 0 ? (
                      <Chip tone="danger" asButton={false} size="sm">
                        возврат {formatMoney(refundAmount)}
                      </Chip>
                    ) : null}
                  </div>
                  {pharmacy ? <p className="text-xs font-semibold text-on-surface-variant">{pharmacy.title}</p> : null}
                  {pickupHint ? (
                    <p
                      className={`flex items-center gap-1 text-[11px] font-semibold ${
                        pickupHint.canPickupToday ? "text-primary" : "text-warning"
                      }`}
                    >
                      <Icon name="clock" size={12} />
                      <span className="truncate">
                        {pickupHint.buttonText}
                        {pickupHint.isAllDay ? "" : ` · ${pickupHint.hoursHint}`}
                      </span>
                    </p>
                  ) : null}
                  {order.createdAtUtc ? (
                    <p className="text-[11px] text-on-surface-variant/70">
                      {new Date(order.createdAtUtc).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  {awaiting ? (
                    <Chip tone="warning" asButton={false} leftIcon="clock" size="sm">{statusLabel}</Chip>
                  ) : (
                    <OrderStatusBadge status={order.status} />
                  )}
                  <Icon
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    className="text-on-surface-variant"
                  />
                </div>
              </button>

              {/* Payment button + warning for awaiting orders */}
              {awaiting ? (
                <div className="flex items-center gap-2 px-4 pb-3">
                  {d.paymentUrl ? (
                    <a
                      href={d.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <Button size="sm" rightIcon="arrow-right">Оплатить</Button>
                    </a>
                  ) : null}
                  <p className="text-[10px] font-semibold leading-tight text-warning">
                    Оплатите в течение 24ч, иначе заказ будет отменён
                  </p>
                </div>
              ) : null}

              {isExpanded ? (() => {
                const positions = d.positions ?? [];
                const detailCost = cost;
                const detailRefund = refundAmount;
                const detailOriginal = originalPaid;
                const isCancelled = d.status === "Cancelled";
                const isReturned = d.status === "Returned";
                const hasRejects = rejectedRefund > 0;
                const hasReturns = returnedRefund > 0;

                return (
                  <div className="border-t border-surface-container-high px-1.5 xs:px-3 sm:px-4 pb-2 xs:pb-4 pt-1.5 xs:pt-3 space-y-2 xs:space-y-3">
                    {/* Order info */}
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5 xs:gap-2 text-[10px] xs:text-xs sm:text-sm">
                      {pharmacy ? (
                        <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                          <p className="text-[10px] text-on-surface-variant uppercase">Аптека</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold">{pharmacy.title}</p>
                          {(resolvedAddresses[pharmacy.id] ?? pharmacy.address) ? (
                            <p className="text-[10px] text-on-surface-variant">
                              {resolvedAddresses[pharmacy.id] ?? pharmacy.address}
                            </p>
                          ) : null}
                          {pickupHint ? (
                            <p
                              className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${
                                pickupHint.canPickupToday ? "text-primary" : "text-warning"
                              }`}
                            >
                              <Icon name="clock" size={10} />
                              <span>
                                {pickupHint.buttonText}
                                {pickupHint.isAllDay ? "" : ` · ${pickupHint.hoursHint}`}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase">Доставка</p>
                        <p className="text-[10px] xs:text-xs sm:text-sm font-bold">{order.isPickup ? "Самовывоз" : order.deliveryAddress || "—"}</p>
                        {!order.isPickup && d.deliveryCost ? (
                          <p className="text-[10px] text-on-surface-variant">Стоимость: {formatMoney(d.deliveryCost, d.currency)}</p>
                        ) : null}
                        {!order.isPickup && formatJuraDeliveryStatus(d.juraStatusId) ? (
                          <p className="text-[10px] text-emerald-700 font-semibold">{formatJuraDeliveryStatus(d.juraStatusId)}</p>
                        ) : null}
                        {!order.isPickup && d.driverName ? (
                          <p className="text-[10px] text-emerald-600">
                            Водитель: {d.driverName}
                            {d.driverPhone ? (
                              <> (<a href={`tel:${d.driverPhone}`} className="underline">{d.driverPhone}</a>)</>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                        <p className="text-[10px] text-on-surface-variant uppercase">Сумма заказа</p>
                        <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-primary">{detailOriginal > 0 ? formatMoney(detailOriginal, d.currency) : "—"}</p>
                      </div>
                      {(hasRejects || hasReturns) && !isCancelled ? (
                        <div className="rounded-xl bg-surface-container-low p-2 xs:p-2.5">
                          <p className="text-[10px] text-on-surface-variant uppercase">За полученные товары</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-on-surface">{formatMoney(detailCost, d.currency)}</p>
                        </div>
                      ) : null}
                      {hasRejects ? (
                        <div className="rounded-xl bg-red-50 p-2 xs:p-2.5">
                          <p className="text-[10px] text-red-600 uppercase">Возврат за отклонённые</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-red-700">{formatMoney(rejectedRefund, d.currency)}</p>
                        </div>
                      ) : null}
                      {hasReturns ? (
                        <div className="rounded-xl bg-red-50 p-2 xs:p-2.5">
                          <p className="text-[10px] text-red-600 uppercase">Возврат за возвращённые</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-red-700">{formatMoney(returnedRefund, d.currency)}</p>
                        </div>
                      ) : null}
                      {isCancelled ? (
                        <div className="rounded-xl bg-red-50 p-2 xs:p-2.5">
                          <p className="text-[10px] text-red-600 uppercase">К возврату (заказ отменён)</p>
                          <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-red-700">{formatMoney(detailRefund, d.currency)}</p>
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

                    {/* Receipt code — show when courier is active */}
                    {shouldShowReceiptCode(d) ? (
                      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-container p-5 text-center text-white shadow-glass">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Код для курьера</p>
                        <p className="mt-2 font-display text-4xl font-extrabold tracking-[0.4em] tabular-nums">
                          {d.recipientCode}
                        </p>
                        <p className="mt-2 text-[11px] opacity-90">Назовите курьеру при получении</p>
                      </div>
                    ) : null}

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
                                <img src={`${env.apiBaseUrl}/api/medicines/images/${(pos.medicine.images[0] as { id: string }).id}/content?w=120`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
                            ) : (pos.returnedQuantity ?? 0) > 0 ? (
                              <span className="flex-shrink-0 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700" title={`Возвращено ${pos.returnedQuantity} из ${pos.quantity}`}>
                                возврат {pos.returnedQuantity}/{pos.quantity}
                              </span>
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

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                      {CANCELLABLE.has(order.status) ? (
                        <Button
                          variant="danger"
                          size="md"
                          fullWidth
                          leftIcon="close"
                          onClick={() => onCancel(order.orderId)}
                          loading={cancellingId === order.orderId}
                        >
                          Отменить заказ
                        </Button>
                      ) : null}
                      {["Delivered", "PickedUp", "Cancelled", "Returned"].includes(order.status) && order.pharmacyId ? (
                        <Button
                          variant="outline"
                          size="md"
                          fullWidth
                          leftIcon="clock"
                          onClick={() => onRepeat(order)}
                          loading={repeatingId === order.orderId}
                        >
                          Повторить заказ
                        </Button>
                      ) : null}
                    </div>
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
