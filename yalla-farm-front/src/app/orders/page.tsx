"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientOrderHistory, cancelOrder } from "@/entities/order/api";
import type { ApiOrder } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

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

export default function OrdersPage() {
  const token = useAppSelector((state) => state.auth.token);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
        <div className="stitch-card p-6 text-sm">
          <Link href="/login" className="font-bold text-primary">Войдите</Link> чтобы видеть заказы.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Мои заказы" backHref="/" />}>
      <div className="space-y-4">
        {isLoading ? <div className="stitch-card p-6 text-sm">Загрузка...</div> : null}
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {!isLoading && orders.length === 0 ? (
          <div className="stitch-card p-6 text-sm text-on-surface-variant">У вас ещё нет заказов.</div>
        ) : null}

        {orders.map((order) => {
          const isExpanded = expandedId === order.orderId;
          const statusColor = STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600";
          const statusLabel = STATUS_LABELS[order.status] ?? order.status;

          return (
            <article key={order.orderId} className="stitch-card overflow-hidden">
              {/* Header - always visible */}
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() => setExpandedId(isExpanded ? null : order.orderId)}
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
              {isExpanded ? (
                <div className="border-t border-surface-container-high px-4 pb-4 pt-3 space-y-3">
                  <div className="space-y-1 text-sm">
                    {order.pharmacyTitle ? (
                      <p><span className="text-on-surface-variant">Аптека:</span> {order.pharmacyTitle}</p>
                    ) : null}
                    <p>
                      <span className="text-on-surface-variant">Доставка:</span>{" "}
                      {order.isPickup ? "Самовывоз" : order.deliveryAddress ?? "—"}
                    </p>
                  </div>

                  {/* Positions */}
                  {(order.positions ?? []).length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Позиции</p>
                      {order.positions!.map((pos) => (
                        <div key={pos.positionId} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                          <span className={pos.isRejected ? "line-through text-on-surface-variant" : ""}>
                            {pos.medicine?.title ?? pos.medicineId.slice(0, 8)} × {pos.quantity}
                          </span>
                          <span className="font-semibold">{formatMoney(pos.price * pos.quantity)}</span>
                        </div>
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
              ) : null}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
