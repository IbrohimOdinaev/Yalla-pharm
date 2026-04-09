"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney } from "@/shared/lib/format";
import {
  getAdminOrders,
  startAssembly,
  markReady,
  markOnTheWay,
  deleteNewOrder,
  rejectPositions,
} from "@/entities/order/admin-api";
import type { ApiOrder } from "@/shared/types/api";
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
  Cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800",
  UnderReview: "bg-yellow-100 text-yellow-800",
  Preparing: "bg-orange-100 text-orange-800",
  Ready: "bg-emerald-100 text-emerald-800",
  OnTheWay: "bg-purple-100 text-purple-800",
  Delivered: "bg-green-100 text-green-800",
  Returned: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-100 text-gray-800",
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = String(params?.id || "");
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const router = useRouter();

  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());

  const loadOrder = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    getAdminOrders(token)
      .then((orders) => {
        const found = orders.find((o) => o.orderId === orderId);
        setOrder(found ?? null);
        if (!found) setError("Заказ не найден в текущей аптеке.");
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

  if (!token || role !== "Admin") {
    return (
      <AppShell top={<TopBar title="Заказ" backHref="back" />} hideGlobalNav>
        <div className="stitch-card p-6 text-sm">Доступ запрещён.</div>
      </AppShell>
    );
  }

  async function onAction(action: string) {
    if (!token || !order) return;
    setActionLoading(true);
    setError(null);
    try {
      if (action === "assembly") await startAssembly(token, order.orderId);
      if (action === "ready") await markReady(token, order.orderId);
      if (action === "ontheway") await markOnTheWay(token, order.orderId);
      if (action === "delete") {
        await deleteNewOrder(token, order.orderId);
        router.push("/workspace");
        return;
      }
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка выполнения действия");
    } finally {
      setActionLoading(false);
    }
  }

  async function onReject() {
    if (!token || !order || selectedPositions.size === 0) return;
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
      if (next.has(positionId)) {
        next.delete(positionId);
      } else {
        next.add(positionId);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <AppShell top={<TopBar title="Заказ" backHref="back" />} hideGlobalNav>
        <div className="stitch-card p-6 text-sm">Загрузка...</div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell top={<TopBar title="Заказ" backHref="back" />} hideGlobalNav>
        <div className="stitch-card p-6 text-sm text-on-surface-variant">
          {error ?? "Заказ не найден."}
        </div>
      </AppShell>
    );
  }

  const positions = order.positions ?? [];
  const status = order.status ?? "New";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800";

  return (
    <AppShell top={<TopBar title={`Заказ #${orderId.slice(0, 8)}`} backHref="back" />} hideGlobalNav>
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        {/* Order info */}
        <section className="stitch-card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm xs:text-base sm:text-lg font-bold">Информация о заказе</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">ID заказа</span>
              <span className="font-mono text-xs">{orderId}</span>
            </div>
            {order.createdAtUtc && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Дата</span>
                <span>{new Date(order.createdAtUtc).toLocaleString("ru-RU")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Сумма</span>
              <span className="font-bold text-primary">{formatMoney(order.cost, order.currency)}</span>
            </div>
            {order.returnCost != null && order.returnCost > 0 && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Возврат</span>
                <span className="font-bold text-red-600">{formatMoney(order.returnCost, order.currency)}</span>
              </div>
            )}
            {order.pharmacyTitle && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Аптека</span>
                <span>{order.pharmacyTitle}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Тип</span>
              <span>{order.isPickup ? "Самовывоз" : "Доставка"}</span>
            </div>
            {order.deliveryAddress && !order.isPickup && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Адрес</span>
                <span>{order.deliveryAddress}</span>
              </div>
            )}
            {(order.clientId || order.clientPhoneNumber) && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Клиент</span>
                <div className="text-right">
                  {order.clientPhoneNumber ? <span className="font-mono text-xs">{order.clientPhoneNumber}</span> : null}
                  {order.clientId ? <span className="font-mono text-xs text-on-surface-variant ml-2">{order.clientId.slice(0, 8)}</span> : null}
                </div>
              </div>
            )}
            {order.paymentState && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Статус оплаты</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  order.paymentState === "Confirmed" ? "bg-emerald-100 text-emerald-800"
                  : order.paymentState === "PendingManualConfirmation" ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-700"
                }`}>
                  {order.paymentState === "Confirmed" ? "Подтверждена"
                   : order.paymentState === "PendingManualConfirmation" ? "Ожидает подтверждения"
                   : order.paymentState === "Expired" ? "Истекла"
                   : order.paymentState}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Positions */}
        <section className="stitch-card space-y-3 p-5">
          <h3 className="text-sm xs:text-base sm:text-lg font-bold">Позиции ({positions.length})</h3>
          {positions.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Нет позиций.</p>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => {
                const medicineName = pos.medicine?.title || pos.medicine?.name || pos.medicineId.slice(0, 8);
                const isRejected = pos.isRejected === true;
                const canSelect = status === "Preparing" && !isRejected;

                return (
                  <div
                    key={pos.positionId}
                    className={`flex items-center gap-1.5 xs:gap-2 sm:gap-3 rounded-xl p-2 xs:p-2.5 sm:p-3 transition ${isRejected ? "bg-red-50 opacity-60" : "bg-surface-container-low"}`}
                  >
                    {canSelect && (
                      <input
                        type="checkbox"
                        checked={selectedPositions.has(pos.positionId)}
                        onChange={() => togglePosition(pos.positionId)}
                        className="h-4 w-4 rounded"
                      />
                    )}
                    <div className="flex-1">
                      <Link
                        href={`/product/${pos.medicineId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {medicineName}
                      </Link>
                      <p className="text-xs text-on-surface-variant">
                        {pos.quantity} x {formatMoney(pos.price, order.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatMoney(pos.quantity * pos.price, order.currency)}</p>
                      {isRejected && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          Отклонено
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reject selected positions */}
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
        </section>

        {/* Refund request */}
        {order.refundRequest && (
          <section className="stitch-card space-y-2 p-5">
            <h3 className="text-sm xs:text-base sm:text-lg font-bold">Запрос на возврат</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-on-surface-variant">Статус:</span> {order.refundRequest.status}</p>
              {order.refundRequest.reason && (
                <p><span className="text-on-surface-variant">Причина:</span> {order.refundRequest.reason}</p>
              )}
              {order.refundRequest.amount != null && (
                <p><span className="text-on-surface-variant">Сумма:</span> {formatMoney(order.refundRequest.amount, order.refundRequest.currency)}</p>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="stitch-card space-y-3 p-5">
          <h3 className="text-sm xs:text-base sm:text-lg font-bold">Действия</h3>
          <div className="flex flex-wrap gap-2">
            {(status === "New" || status === "UnderReview") && (
              <button
                type="button"
                className="stitch-button text-sm"
                onClick={() => onAction("assembly")}
                disabled={actionLoading}
              >
                Начать сборку
              </button>
            )}
            {status === "Preparing" && (
              <button
                type="button"
                className="stitch-button text-sm"
                onClick={() => onAction("ready")}
                disabled={actionLoading}
              >
                Готов к выдаче
              </button>
            )}
            {status === "Ready" && (
              <button
                type="button"
                className="stitch-button text-sm"
                onClick={() => onAction("ontheway")}
                disabled={actionLoading}
              >
                {order.isPickup ? "Выдан клиенту" : "Отправить (В пути)"}
              </button>
            )}
            {status === "New" && (
              <button
                type="button"
                className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-200"
                onClick={() => {
                  if (window.confirm("Удалить этот заказ?")) {
                    onAction("delete");
                  }
                }}
                disabled={actionLoading}
              >
                Удалить заказ
              </button>
            )}
          </div>
        </section>

        <Link href="/workspace" className="stitch-button-secondary inline-block text-sm">
          Назад к заказам
        </Link>
      </div>
    </AppShell>
  );
}
