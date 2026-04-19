"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, deleteMyAccount } from "@/entities/client/api";
import type { ApiClient } from "@/shared/types/api";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useCartStore } from "@/features/cart/model/cartStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { LinkPhoneModal } from "@/widgets/profile/LinkPhoneModal";
import { LinkTelegramModal } from "@/widgets/profile/LinkTelegramModal";

export default function ProfilePage() {
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [profile, setProfile] = useState<ApiClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* profile edit — phone/telegram are read-only; they change only via OTP/bot link flows */
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<string>("");
  const [editDob, setEditDob] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  /* delete */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* linking modals */
  const [showLinkPhone, setShowLinkPhone] = useState(false);
  const [showLinkTelegram, setShowLinkTelegram] = useState(false);

  /* cart */
  const { basket, loadBasket } = useCartStore();

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getMyProfile(token)
      .then((client) => {
        setProfile(client);
        setEditName(client.name);
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
          <p className="text-xs xs:text-sm text-on-surface-variant">Войдите по SMS, чтобы получить доступ к профилю</p>
          <div className="flex justify-center gap-2 xs:gap-3">
            <Link href="/login" className="stitch-button text-sm">Войти по SMS</Link>
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

  async function onDeleteAccount() {
    if (!token) return;
    setIsDeleting(true);
    try {
      await deleteMyAccount(token);
      dispatch(clearCredentials());
      router.push("/login");
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
                {profile.phoneNumber && !profile.phoneNumber.startsWith("tg_") ? (
                  <p className="mt-1.5 text-xs xs:text-sm opacity-80 font-mono">+992{profile.phoneNumber}</p>
                ) : profile.telegramUsername ? (
                  <p className="mt-1.5 text-xs xs:text-sm opacity-80">@{profile.telegramUsername}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {profile ? (
          <>
            {/* Linking — phone and telegram */}
            {(() => {
              const phoneLinked = !!profile.phoneNumber && !profile.phoneNumber.startsWith("tg_");
              const telegramLinked = !!profile.telegramUsername || (profile.telegramId != null && profile.telegramId !== 0);
              if (phoneLinked && telegramLinked) return null;
              return (
                <div className="stitch-card space-y-3 p-3 xs:p-4 sm:p-5">
                  <h2 className="text-base xs:text-lg font-bold">Привязка аккаунта</h2>
                  <p className="text-xs text-on-surface-variant">Привяжите оба способа входа — номер телефона и Telegram — чтобы входить любым из них в один и тот же аккаунт.</p>

                  {!phoneLinked ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-container-high bg-surface-container-lowest p-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Номер телефона</p>
                          <p className="text-xs text-on-surface-variant">Ещё не привязан</p>
                        </div>
                      </div>
                      <button type="button" className="stitch-button px-3 py-2 text-xs flex-shrink-0" onClick={() => setShowLinkPhone(true)}>Привязать</button>
                    </div>
                  ) : null}

                  {!telegramLinked ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-container-high bg-surface-container-lowest p-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#229ED9]/10 flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#229ED9]"><path d="M21.943 4.116a1.5 1.5 0 0 0-1.567-.196L2.91 11.123a1.5 1.5 0 0 0 .128 2.787l4.378 1.477 1.69 5.39a1 1 0 0 0 1.69.39l2.42-2.42 4.55 3.34a1.5 1.5 0 0 0 2.367-.94l3-15a1.5 1.5 0 0 0-1.19-1.83zM10 16l-.66 3.13L8 14.5l9-7-7 8.5z"/></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Telegram</p>
                          <p className="text-xs text-on-surface-variant">Ещё не привязан</p>
                        </div>
                      </div>
                      <button type="button" className="stitch-button px-3 py-2 text-xs flex-shrink-0" onClick={() => setShowLinkTelegram(true)}>Привязать</button>
                    </div>
                  ) : null}
                </div>
              );
            })()}

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
                <input
                  className="stitch-input bg-surface-container-low cursor-not-allowed font-mono"
                  type="tel"
                  value={profile.phoneNumber && !profile.phoneNumber.startsWith("tg_") ? `+992${profile.phoneNumber}` : ""}
                  readOnly
                  placeholder="Не привязан"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Telegram</span>
                <input
                  className="stitch-input bg-surface-container-low cursor-not-allowed"
                  type="text"
                  value={profile.telegramUsername ? `@${profile.telegramUsername}` : ""}
                  readOnly
                  placeholder="Не привязан"
                />
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

      {token ? (
        <>
          <LinkPhoneModal
            open={showLinkPhone}
            token={token}
            onClose={() => setShowLinkPhone(false)}
            onSuccess={async () => {
              try {
                const updated = await getMyProfile(token);
                setProfile(updated);
              } catch { /* ignore */ }
            }}
          />
          <LinkTelegramModal
            open={showLinkTelegram}
            token={token}
            onClose={() => setShowLinkTelegram(false)}
            onSuccess={async () => {
              try {
                const updated = await getMyProfile(token);
                setProfile(updated);
              } catch { /* ignore */ }
            }}
          />
        </>
      ) : null}
    </AppShell>
  );
}
