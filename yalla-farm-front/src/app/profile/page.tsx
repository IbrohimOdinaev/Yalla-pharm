"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, deleteMyAccount, changePassword } from "@/entities/client/api";
import type { ApiClient } from "@/shared/types/api";
import { formatPhone } from "@/shared/lib/format";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useCartStore } from "@/features/cart/model/cartStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

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
  const [editGender, setEditGender] = useState<string>("");
  const [editDob, setEditDob] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  /* password */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /* delete */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* cart */
  const { basket, loadBasket } = useCartStore();

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getMyProfile(token)
      .then((client) => {
        setProfile(client);
        setEditName(client.name);
        setEditPhone(client.phoneNumber);
        setEditGender(client.gender != null ? String(client.gender) : "");
        setEditDob(client.dateOfBirth ?? "");
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить профиль.");
        setIsLoading(false);
      });

    // Load cart
    loadBasket(token);
  }, [token, loadBasket]);

  if (!token) {
    return (
      <AppShell top={<TopBar title="Профиль" backHref="back" />}>
        <div className="stitch-card p-4 xs:p-6 sm:p-8 text-center space-y-2 xs:space-y-3 sm:space-y-4">
          <div className="mx-auto w-14 h-14 xs:w-16 xs:h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          </div>
          <h2 className="text-base xs:text-lg font-bold">Требуется авторизация</h2>
          <p className="text-xs xs:text-sm text-on-surface-variant">Войдите или зарегистрируйтесь для доступа</p>
          <div className="flex justify-center gap-2 xs:gap-3">
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
      await updateMyProfile(token, {
        name: editName || undefined,
        phoneNumber: editPhone ? formatPhone(editPhone) : undefined,
        gender: editGender ? Number(editGender) : null,
        dateOfBirth: editDob || null,
      });
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
    <AppShell top={<TopBar title="Профиль" backHref="back" />}>
      <div className="mx-auto max-w-md px-0 xs:px-2 sm:px-4 space-y-2 xs:space-y-3 sm:space-y-5">
        {isLoading ? <div className="stitch-card p-3 xs:p-4 sm:p-6 text-xs xs:text-sm">Загрузка...</div> : null}
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {/* Personalized hero */}
        {profile ? (
          <div className="rounded-2xl bg-gradient-to-br from-primary to-[#0070eb] p-3 xs:p-4 sm:p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Мой профиль</p>
                <h1 className="mt-1 text-base xs:text-lg sm:text-2xl font-extrabold truncate">Здравствуйте, {profile.name || "Клиент"}</h1>
                <p className="mt-1.5 text-xs xs:text-sm opacity-80 font-mono">{profile.phoneNumber}</p>
              </div>
            </div>
          </div>
        ) : null}

        {profile ? (
          <>
            {/* Profile info */}
            <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onSaveProfile}>
              <h2 className="text-base xs:text-lg font-bold">Личные данные</h2>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Имя</span>
                <input className="stitch-input" placeholder="Ваше имя" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Пол</span>
                <select className="stitch-input" value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                  <option value="">Не указан</option>
                  <option value="1">Мужской</option>
                  <option value="2">Женский</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Дата рождения</span>
                <input className="stitch-input" type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
              </label>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Телефон</span>
                <input className="stitch-input" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </label>

              {profileMsg ? (
                <div className={`rounded-xl p-3 text-sm ${profileMsg.includes("обновлён") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {profileMsg}
                </div>
              ) : null}

              <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isSavingProfile}>
                {isSavingProfile ? "Сохраняем..." : "Сохранить"}
              </button>
            </form>

            {/* Change password */}
            <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onChangePassword}>
              <h2 className="text-base xs:text-lg font-bold">Смена пароля</h2>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Текущий пароль</span>
                <input className="stitch-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </label>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Новый пароль</span>
                <input className="stitch-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Минимум 8 символов" required />
              </label>

              {passwordError ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{passwordError}</div> : null}
              {passwordMsg ? <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{passwordMsg}</div> : null}

              <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isChangingPassword}>
                {isChangingPassword ? "Меняем..." : "Обновить пароль"}
              </button>
            </form>

            {/* Mini cart preview */}
            {(basket.positions ?? []).length > 0 ? (
              <div className="stitch-card p-3 xs:p-4 sm:p-5 space-y-2 xs:space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base xs:text-lg font-bold">Корзина</h2>
                  <Link href="/cart" className="text-sm font-bold text-primary">Открыть</Link>
                </div>
                <p className="text-xs xs:text-sm text-on-surface-variant">{basket.positions!.length} товаров в корзине</p>
              </div>
            ) : null}

            {/* Logout */}
            <button type="button" className="stitch-button-secondary w-full min-h-[44px]" onClick={onLogout}>
              Выйти из аккаунта
            </button>

            {/* Delete account */}
            <div className="stitch-card space-y-2 xs:space-y-3 p-3 xs:p-4 sm:p-6">
              <h2 className="text-base xs:text-lg font-bold text-red-700">Удаление аккаунта</h2>
              <p className="text-xs xs:text-sm text-on-surface-variant">История заказов сохранится, но доступ к профилю будет потерян.</p>

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
