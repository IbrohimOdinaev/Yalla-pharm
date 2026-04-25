"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/shared/lib/format";
import {
  getAdminOrders,
  startAssembly,
  markReady,
  markOnTheWay,
  deleteNewOrder,
  rejectPositions,
} from "@/entities/order/admin-api";
import { cancelDelivery } from "@/shared/api/delivery";
import { DispatchDeliveryModal } from "@/widgets/order/DispatchDeliveryModal";
import {
  computeOriginalPaid,
  computeItemsTotal,
  computeRejectedRefund,
  computeReturnedRefund,
  computeNetCost,
  isOrderDataLost,
} from "@/entities/order/totals";
import type { ApiOrder } from "@/shared/types/api";

const STATUS_LABELS: Record<string, string> = {
  New: "Новый",
  UnderReview: "На рассмотрении",
  Preparing: "Собирается",
  Ready: "Готов",
  OnTheWay: "В пути",
  DriverArrived: "Водитель на месте",
  Delivered: "Доставлен",
  PickedUp: "Забран клиентом",
  Returned: "Возврат",
  Cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800",
  UnderReview: "bg-yellow-100 text-yellow-800",
  Preparing: "bg-orange-100 text-orange-800",
  Ready: "bg-emerald-100 text-emerald-800",
  OnTheWay: "bg-purple-100 text-purple-800",
  DriverArrived: "bg-purple-200 text-purple-900",
  Delivered: "bg-green-100 text-green-800",
  PickedUp: "bg-green-100 text-green-800",
  Returned: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-100 text-gray-800",
};

type Props = {
  orderId: string;
  token: string;
  onClose: () => void;
  onDeleted?: () => void;
};

export function AdminOrderDetailModal({ orderId, token, onClose, onDeleted }: Props) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);

  const loadOrder = useCallback(() => {
    if (!token) return;
    getAdminOrders(token)
      .then((orders) => {
        const found = orders.find((o) => o.orderId === orderId);
        setOrder(found ?? null);
        if (!found) setError("Заказ не найден.");
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
        setIsLoading(false);
      });
  }, [token, orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Refresh when tab regains focus + light polling to catch JURA auto-transitions.
  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === "visible") loadOrder();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(loadOrder, 10000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(t);
    };
  }, [loadOrder]);

  async function onAction(action: string) {
    if (!order) return;
    const prompts: Record<string, string> = {
      assembly: `Начать сборку заказа #${order.orderId.slice(0, 8)}?`,
      ready: `Отметить заказ #${order.orderId.slice(0, 8)} собранным?`,
      ontheway: order.isPickup
        ? `Отметить заказ #${order.orderId.slice(0, 8)} выданным клиенту?`
        : `Передать заказ #${order.orderId.slice(0, 8)} в доставку?`,
      delete: `Удалить новый заказ #${order.orderId.slice(0, 8)}? Это действие необратимо.`,
    };
    if (prompts[action] && !confirm(prompts[action])) return;

    setActionLoading(true);
    setError(null);
    try {
      if (action === "assembly") await startAssembly(token, order.orderId);
      if (action === "ready") await markReady(token, order.orderId);
      if (action === "ontheway") await markOnTheWay(token, order.orderId);
      if (action === "delete") {
        await deleteNewOrder(token, order.orderId);
        onDeleted?.();
        onClose();
        return;
      }
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка выполнения действия");
    } finally {
      setActionLoading(false);
    }
  }

  async function onCancelDeliveryClick() {
    if (!order) return;
    const reason = prompt("Причина отмены доставки (необязательно):");
    if (reason === null) return;
    setActionLoading(true);
    setError(null);
    try {
      await cancelDelivery(token, order.orderId, reason || undefined);
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить доставку.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onReject() {
    if (!order || selectedPositions.size === 0) return;
    if (!confirm(`Отклонить ${selectedPositions.size} позицию(й) в заказе #${order.orderId.slice(0, 8)}?`)) return;
    setActionLoading(true);
    setError(null);
    try {
      await rejectPositions(token, order.orderId, Array.from(selectedPositions));
      setSelectedPositions(new Set());
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отклонения позиций");
    } finally {
      setActionLoading(false);
    }
  }

  function togglePosition(positionId: string) {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(positionId)) next.delete(positionId);
      else next.add(positionId);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-start justify-center p-4 pt-16 overflow-y-auto" onClick={onClose}>
        <div className="stitch-card w-full max-w-2xl p-6 text-sm" onClick={(e) => e.stopPropagation()}>Загрузка...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-start justify-center p-4 pt-16 overflow-y-auto" onClick={onClose}>
        <div className="stitch-card w-full max-w-2xl p-6 text-sm text-on-surface-variant" onClick={(e) => e.stopPropagation()}>
          {error ?? "Заказ не найден."}
        </div>
      </div>
    );
  }

  const positions = order.positions ?? [];
  const status = order.status ?? "New";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800";
  const rejected = computeRejectedRefund(order);
  const returned = computeReturnedRefund(order);
  const net = computeNetCost(order);
  const hasRefunds = rejected > 0 || returned > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={onClose}>
        <div className="stitch-card w-full max-w-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-on-surface-variant">#{orderId.slice(0, 8)}</p>
              <h2 className="text-xl font-extrabold">Заказ</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-surface-container-low p-2 hover:bg-surface-container-high"
              aria-label="Закрыть"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {error && <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div>}

          {isOrderDataLost(order) ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-bold">⚠ Данные позиций утеряны</p>
              <p className="mt-0.5 text-xs text-amber-800">
                Этот заказ — исторический: записи позиций отсутствуют в БД.
                Сумма и состав показаны как 0 — данные восстановить нельзя.
              </p>
            </div>
          ) : null}

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 text-sm">
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-[10px] text-on-surface-variant uppercase">Статус</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${statusColor}`}>{statusLabel}</span>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-[10px] text-on-surface-variant uppercase">Итого</p>
              <p className="font-bold text-primary">{formatMoney(computeOriginalPaid(order), order.currency)}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-[10px] text-on-surface-variant uppercase">
                {order.isPickup ? "Тип" : "Доставка"}
              </p>
              <p className="font-bold">{order.isPickup ? "Самовывоз" : (order.deliveryAddress || "—")}</p>
              {!order.isPickup && (order.deliveryCost ?? 0) > 0 ? (
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {formatMoney(order.deliveryCost ?? 0, order.currency)}
                  {order.deliveryDistance != null ? ` · ${order.deliveryDistance.toFixed(1)} км` : ""}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-[10px] text-on-surface-variant uppercase">Дата</p>
              <p className="font-bold">{order.createdAtUtc ? new Date(order.createdAtUtc).toLocaleString("ru-RU") : "—"}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-[10px] text-on-surface-variant uppercase">Товары</p>
              <p className="font-bold">{formatMoney(computeItemsTotal(order), order.currency)}</p>
            </div>
            {order.clientPhoneNumber || order.clientId || order.clientName || order.clientTelegramUsername || order.clientTelegramId ? (
              <div className="rounded-xl bg-surface-container-low p-3 space-y-0.5">
                <p className="text-[10px] text-on-surface-variant uppercase">Клиент</p>
                {order.clientName ? <p className="font-bold">{order.clientName}</p> : null}
                {order.clientPhoneNumber ? (
                  <p className="font-mono text-sm">{order.clientPhoneNumber}</p>
                ) : order.clientId ? (
                  <p className="font-mono text-sm">{order.clientId.slice(0, 8)}</p>
                ) : null}
                {order.clientTelegramUsername ? (
                  <p className="font-mono text-xs text-tertiary">@{order.clientTelegramUsername.replace(/^@/, "")}</p>
                ) : order.clientTelegramId ? (
                  <p className="font-mono text-xs text-tertiary">tg:{order.clientTelegramId}</p>
                ) : null}
              </div>
            ) : null}
            {order.paymentState ? (
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Оплата</p>
                <p className={`font-bold ${order.paymentState === "Confirmed" ? "text-emerald-600" : order.paymentState === "Expired" ? "text-red-600" : "text-yellow-600"}`}>
                  {order.paymentState === "Confirmed" ? "Подтверждена"
                    : order.paymentState === "PendingManualConfirmation" ? "Ожидает"
                    : order.paymentState === "Expired" ? "Истекла"
                    : order.paymentState}
                </p>
              </div>
            ) : null}
            {hasRefunds ? (
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">За полученные</p>
                <p className="font-bold">{formatMoney(net, order.currency)}</p>
              </div>
            ) : null}
            {rejected > 0 ? (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-[10px] text-red-600 uppercase">Возврат за отклонённые</p>
                <p className="font-bold text-red-700">{formatMoney(rejected, order.currency)}</p>
              </div>
            ) : null}
            {returned > 0 ? (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-[10px] text-red-600 uppercase">Возврат за возвращённые</p>
                <p className="font-bold text-red-700">{formatMoney(returned, order.currency)}</p>
              </div>
            ) : null}
          </div>

          {/* Client comment */}
          {order.comment ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
              <p className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold">Комментарий клиента</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{order.comment}</p>
            </div>
          ) : null}

          {/* JURA delivery card */}
          {!order.isPickup && order.juraOrderId != null ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
              <p className="text-[10px] text-emerald-700 uppercase tracking-wider font-semibold">Доставка JURA</p>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">JURA заказ</span>
                <span className="font-mono">#{order.juraOrderId}</span>
              </div>
              {order.juraStatus ? (
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Статус</span>
                  <span>{order.juraStatus}</span>
                </div>
              ) : null}
              {order.driverName ? (
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Водитель</span>
                  <span>{order.driverName}</span>
                </div>
              ) : null}
              {order.driverPhone ? (
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Телефон</span>
                  <a href={`tel:${order.driverPhone}`} className="font-mono text-primary hover:underline">{order.driverPhone}</a>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Positions */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Позиции ({positions.length})</h3>
            {positions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Нет позиций.</p>
            ) : (
              positions.map((pos) => {
                const medicineName = pos.medicine?.title || pos.medicine?.name || pos.medicineId.slice(0, 8);
                const isRejected = pos.isRejected === true;
                const canSelect = status === "Preparing" && !isRejected;

                return (
                  <div
                    key={pos.positionId}
                    className={`flex items-center gap-3 rounded-xl p-3 transition ${isRejected ? "bg-red-50 opacity-60" : "bg-surface-container-low"}`}
                  >
                    {canSelect && (
                      <input
                        type="checkbox"
                        checked={selectedPositions.has(pos.positionId)}
                        onChange={() => togglePosition(pos.positionId)}
                        className="h-4 w-4 rounded"
                      />
                    )}
                    <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-surface-container flex items-center justify-center text-xs text-on-surface-variant font-bold">
                      {medicineName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/product/${pos.medicineId}`}
                        className="text-sm font-bold truncate block hover:text-primary"
                      >
                        {medicineName}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span>{pos.quantity} шт.</span>
                        <span>&times;</span>
                        <span className="font-bold text-primary">{formatMoney(pos.price, order.currency)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatMoney(pos.quantity * pos.price, order.currency)}</p>
                      {isRejected && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Отклонено</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {status === "Preparing" && selectedPositions.size > 0 && (
              <button
                type="button"
                className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-200"
                onClick={onReject}
                disabled={actionLoading}
              >
                Отклонить выбранные ({selectedPositions.size})
              </button>
            )}
          </div>

          {/* Refund */}
          {order.refundRequest && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm">
              <p className="font-bold text-yellow-800">Запрос на возврат</p>
              <p className="text-yellow-700">
                {order.refundRequest.amount != null ? `Сумма: ${formatMoney(order.refundRequest.amount, order.refundRequest.currency)} · ` : ""}
                Статус: {order.refundRequest.status}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-container-high">
            {(status === "New" || status === "UnderReview") && (
              <button type="button" className="stitch-button text-sm" onClick={() => onAction("assembly")} disabled={actionLoading}>
                Начать сборку
              </button>
            )}
            {status === "Preparing" && (
              <button type="button" className="stitch-button text-sm" onClick={() => onAction("ready")} disabled={actionLoading}>
                Готов к выдаче
              </button>
            )}
            {status === "Ready" && !order.isPickup && !order.juraOrderId && (
              <button type="button" className="stitch-button text-sm" onClick={() => setDispatchModalOpen(true)} disabled={actionLoading}>
                Вызвать доставку
              </button>
            )}
            {!order.isPickup && order.juraOrderId != null && (status === "Ready" || status === "OnTheWay") && (
              <button
                type="button"
                className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-200"
                onClick={onCancelDeliveryClick}
                disabled={actionLoading}
              >
                Отменить доставку
              </button>
            )}
            {status === "Ready" && (
              <button type="button" className="stitch-button text-sm" onClick={() => onAction("ontheway")} disabled={actionLoading}>
                {order.isPickup ? "Выдан клиенту" : "Отправить (В пути)"}
              </button>
            )}
            {status === "New" && (
              <button
                type="button"
                className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-200"
                onClick={() => {
                  if (window.confirm("Удалить этот заказ?")) onAction("delete");
                }}
                disabled={actionLoading}
              >
                Удалить заказ
              </button>
            )}
          </div>
        </div>
      </div>

      {!order.isPickup && (
        <DispatchDeliveryModal
          open={dispatchModalOpen}
          token={token}
          order={order}
          onClose={() => setDispatchModalOpen(false)}
          onDispatched={loadOrder}
        />
      )}
    </>
  );
}
