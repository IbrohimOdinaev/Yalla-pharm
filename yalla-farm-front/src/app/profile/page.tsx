"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, deleteMyAccount, changePassword } from "@/entities/client/api";
import type { ApiClient } from "@/shared/types/api";
import { formatMoney, formatPhone } from "@/shared/lib/format";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
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
  }, [token]);

  if (!token) {
    return (
      <AppShell top={<TopBar title="Профиль" backHref="/" />}>
        <div className="stitch-card p-6 text-sm">
          <Link href="/login" className="font-bold text-primary">Войдите</Link> чтобы видеть профиль.
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
