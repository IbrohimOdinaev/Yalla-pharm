"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, deleteMyAccount, changePassword } from "@/entities/client/api";
import { getClientOrderHistory } from "@/entities/order/api";
import type { ApiClient, ApiOrder } from "@/shared/types/api";
import { formatMoney, formatPhone } from "@/shared/lib/format";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useBasketLive } from "@/features/cart/model/useBasketLive";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

const PENDING_KEY = "yalla.front.pending.payment.intent";

type PendingPayment = {
  paymentIntentId: string;
  reservedOrderId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
};

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

export default function ProfilePage() {
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [profile, setProfile] = useState<ApiClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* profile edit */
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  /* password */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /* pending payment */
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);

  /* delete */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* recent orders */
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  /* cart */
  const { basket, loadBasket } = useCartStore();

  useBasketLive();
  useOrderStatusLive(useCallback(() => {
    if (token) getClientOrderHistory(token).then((data) => {
      setOrdersCount(data.length);
      setRecentOrders(data.slice(0, 5));
    }).catch(() => undefined);
  }, [token]));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PENDING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PendingPayment;
        if (parsed.paymentIntentId) setPendingPayment(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getMyProfile(token)
      .then((client) => {
        setProfile(client);
        setEditName(client.name);
        setEditPhone(client.phoneNumber);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить профиль.");
        setIsLoading(false);
      });

    // Load recent orders
    getClientOrderHistory(token)
      .then((data) => {
        setOrdersCount(data.length);
        setRecentOrders(data.slice(0, 5));
      })
      .catch(() => undefined);

    // Load cart
    loadBasket(token);
  }, [token, loadBasket]);

  if (!token) {
    return (
      <AppShell top={<TopBar title="Профиль" backHref="/" />}>
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

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateMyProfile(token, { name: editName, phoneNumber: formatPhone(editPhone) });
      setProfileMsg("Профиль обновлён.");
      const updated = await getMyProfile(token);
      setProfile(updated);
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Ошибка обновления.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPasswordError(null);
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordError("Новый пароль: минимум 8 символов.");
      return;
    }
    if (!/^[A-Za-z0-9!@#$%^&*()\-_=.,?]+$/.test(newPassword)) {
      setPasswordError("Новый пароль содержит недопустимые символы.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(token, currentPassword, newPassword);
      setPasswordMsg("Пароль успешно изменён.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Не удалось сменить пароль.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function onDeleteAccount() {
    if (!token) return;
    setIsDeleting(true);
    try {
      await deleteMyAccount(token);
      dispatch(clearCredentials());
      router.push("/register");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить аккаунт.");
      setIsDeleting(false);
    }
  }

  function onLogout() {
    dispatch(clearCredentials());
    router.push("/login");
  }

  return (
    <AppShell top={<TopBar title="Профиль" backHref="/" />}>
      <div className="mx-auto max-w-md space-y-5">
        {isLoading ? <div className="stitch-card p-6 text-sm">Загрузка...</div> : null}
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {/* Pending payment banner */}
        {pendingPayment ? (
          <div className="stitch-card space-y-3 p-5 ring-2 ring-yellow-400">
            <h2 className="text-lg font-bold text-yellow-800">Ожидающая оплата</h2>
            <p className="text-sm text-on-surface-variant">
              Заказ #{pendingPayment.reservedOrderId.slice(0, 8)} · {formatMoney(pendingPayment.amount, pendingPayment.currency)}
            </p>
            <div className="flex gap-2">
              {pendingPayment.paymentUrl ? (
                <a href={pendingPayment.paymentUrl} className="stitch-button text-sm" target="_blank" rel="noreferrer">
                  Оплатить
                </a>
              ) : null}
              <Link href="/checkout" className="stitch-button-secondary text-sm">Перейти к оформлению</Link>
            </div>
          </div>
        ) : null}

        {/* Feature 10: Personalized hero */}
        {profile ? (
          <div className="rounded-2xl bg-gradient-to-br from-primary to-[#0070eb] p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Мой профиль</p>
                <h1 className="mt-1 text-2xl font-extrabold">Здравствуйте, {profile.name || "Клиент"}</h1>
                <p className="mt-1.5 text-sm opacity-80 font-mono">{profile.phoneNumber}</p>
              </div>
              {ordersCount > 0 ? (
                <div className="text-right">
                  <p className="text-3xl font-black">{ordersCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {ordersCount === 1 ? "заказ" : ordersCount < 5 ? "заказа" : "заказов"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {profile ? (
          <>
            {/* Profile info */}
            <form className="stitch-card space-y-4 p-6" onSubmit={onSaveProfile}>
              <h2 className="text-lg font-bold">Личные данные</h2>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-on-surface-variant">Имя</span>
                <input className="stitch-input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-on-surface-variant">Телефон</span>
                <input className="stitch-input" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required />
              </label>

              {profileMsg ? (
                <div className={`rounded-xl p-3 text-sm ${profileMsg.includes("обновлён") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {profileMsg}
                </div>
              ) : null}

              <button type="submit" className="stitch-button w-full" disabled={isSavingProfile}>
                {isSavingProfile ? "Сохраняем..." : "Сохранить"}
              </button>
            </form>

            {/* Change password */}
            <form className="stitch-card space-y-4 p-6" onSubmit={onChangePassword}>
              <h2 className="text-lg font-bold">Смена пароля</h2>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-on-surface-variant">Текущий пароль</span>
                <input className="stitch-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-on-surface-variant">Новый пароль</span>
                <input className="stitch-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Минимум 8 символов" required />
              </label>

              {passwordError ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{passwordError}</div> : null}
              {passwordMsg ? <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{passwordMsg}</div> : null}

              <button type="submit" className="stitch-button w-full" disabled={isChangingPassword}>
                {isChangingPassword ? "Меняем..." : "Обновить пароль"}
              </button>
            </form>

            {/* Feature 8: Recent orders */}
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Последние заказы</h2>
                {recentOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.orderId;
                  const statusColor = STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600";
                  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

                  return (
                    <article key={order.orderId} className="stitch-card overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between p-4 text-left"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)}
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

                      {isExpanded ? (
                        <div className="px-4 pb-4 pt-1 space-y-2">
                          {order.pharmacyTitle ? (
                            <p className="text-sm"><span className="text-on-surface-variant">Аптека:</span> {order.pharmacyTitle}</p>
                          ) : null}
                          <p className="text-sm">
                            <span className="text-on-surface-variant">Доставка:</span>{" "}
                            {order.isPickup ? "Самовывоз" : order.deliveryAddress ?? "—"}
                          </p>
                          {(order.positions ?? []).length > 0 ? (
                            <div className="space-y-1">
                              {order.positions!.map((pos) => (
                                <div key={pos.positionId} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                                  <Link href={`/product/${pos.medicineId}`} className={`hover:text-primary transition ${pos.isRejected ? "line-through text-on-surface-variant" : ""}`}>
                                    {pos.medicine?.title ?? pos.medicineId.slice(0, 8)} × {pos.quantity}
                                  </Link>
                                  <span className="font-semibold">{formatMoney(pos.price * pos.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                <Link href="/orders" className="block text-center text-sm font-bold text-primary">
                  Все заказы →
                </Link>
              </div>
            ) : null}

            {/* Feature 9: Mini cart preview */}
            {(basket.positions ?? []).length > 0 ? (
              <div className="stitch-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Корзина</h2>
                  <Link href="/cart" className="text-sm font-bold text-primary">Открыть</Link>
                </div>
                <p className="text-sm text-on-surface-variant">{basket.positions!.length} товаров в корзине</p>
              </div>
            ) : null}

            {/* Logout */}
            <button type="button" className="stitch-button-secondary w-full" onClick={onLogout}>
              Выйти из аккаунта
            </button>

            {/* Delete account */}
            <div className="stitch-card space-y-3 p-6">
              <h2 className="text-lg font-bold text-red-700">Удаление аккаунта</h2>
              <p className="text-sm text-on-surface-variant">История заказов сохранится, но доступ к профилю будет потерян.</p>

              {!showDeleteConfirm ? (
                <button type="button" className="rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700" onClick={() => setShowDeleteConfirm(true)}>
                  Удалить аккаунт
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-red-700">Вы уверены? Это действие необратимо.</p>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white" onClick={onDeleteAccount} disabled={isDeleting}>
                      {isDeleting ? "Удаляем..." : "Да, удалить"}
                    </button>
                    <button type="button" className="stitch-button-secondary" onClick={() => setShowDeleteConfirm(false)}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
