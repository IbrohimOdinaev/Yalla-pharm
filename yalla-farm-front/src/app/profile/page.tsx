"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, deleteMyAccount } from "@/entities/client/api";
import { getClientOrderHistory } from "@/entities/order/api";
import { computeNetCost } from "@/entities/order/totals";
import type { ApiClient } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { LinkPhoneModal } from "@/widgets/profile/LinkPhoneModal";
import { LinkTelegramModal } from "@/widgets/profile/LinkTelegramModal";
import { SavedAddressesSection } from "@/widgets/profile/SavedAddressesSection";
import { Button, Chip, DatePicker, EmptyState, Icon, Input, Select } from "@/shared/ui";
import type { IconName } from "@/shared/ui";

export default function ProfilePage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [profile, setProfile] = useState<ApiClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<string>("");
  const [editDob, setEditDob] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showLinkPhone, setShowLinkPhone] = useState(false);
  const [showLinkTelegram, setShowLinkTelegram] = useState(false);

  // Lightweight stats derived from order history. Refunded portions are
  // already excluded by `computeNetCost`, so totals reflect what the
  // customer actually paid.
  const [stats, setStats] = useState({ ordersCount: 0, deliveredCount: 0, totalSpent: 0 });

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
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getClientOrderHistory(token)
      .then((orders) => {
        const isFulfilled = (s?: string) => s === "Delivered" || s === "PickedUp";
        const ordersCount = orders.length;
        const deliveredCount = orders.filter((o) => isFulfilled(o.status)).length;
        const totalSpent = orders
          .filter((o) => isFulfilled(o.status))
          .reduce((sum, o) => sum + computeNetCost(o), 0);
        setStats({ ordersCount, deliveredCount, totalSpent });
      })
      .catch(() => undefined);
  }, [token]);

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
    const wasAdminLike = role === "Admin" || role === "SuperAdmin";
    dispatch(clearCredentials());
    // Admin/SuperAdmin → home via replace so the back button can't bounce the
    // user back into the now-unauthorized workspace. Client → login.
    if (wasAdminLike) {
      router.replace("/");
    } else {
      router.push("/login");
    }
  }

  if (!token) {
    return (
      <AppShell top={<TopBar title="Профиль" backHref="back" />}>
        <EmptyState
          icon="user"
          title="Требуется авторизация"
          description="Войдите по SMS, чтобы получить доступ к профилю"
          action={
            <Link href="/login">
              <Button size="md" rightIcon="arrow-right">Войти по SMS</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const phoneLinked = !!profile?.phoneNumber && !profile.phoneNumber.startsWith("tg_");
  const telegramLinked = !!profile?.telegramUsername || (profile?.telegramId != null && profile?.telegramId !== 0);
  const initials = (profile?.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <AppShell top={<TopBar title="Профиль" backHref="back" />}>
      {/* min-w-0 lets descendant flex/grid children shrink past their
          intrinsic size on narrow viewports (down to ~340px) instead of
          forcing the wrapper to overflow horizontally. */}
      <div className="mx-auto min-w-0 max-w-md space-y-4 lg:max-w-5xl">
        {isLoading ? (
          <div className="rounded-3xl bg-surface-container-low p-6 text-sm">Загрузка...</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {/* Hero card */}
        {profile ? (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-container p-4 text-white shadow-card xs:p-5 lg:p-7">
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <span aria-hidden className="pointer-events-none absolute right-4 bottom-0 h-16 w-16 rounded-full bg-white/10" />
            <div className="relative flex items-start gap-3 xs:gap-4">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/20 font-display text-xl font-extrabold backdrop-blur xs:h-16 xs:w-16 xs:text-2xl lg:h-20 lg:w-20 lg:text-3xl">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 xs:text-[11px]">Мой профиль</p>
                <h1 className="mt-1 truncate font-display text-xl font-extrabold xs:text-2xl lg:text-3xl">{profile.name || "Клиент"}</h1>
                {phoneLinked ? (
                  <p className="mt-1 truncate font-mono text-xs opacity-90 xs:text-sm">+992{profile.phoneNumber}</p>
                ) : telegramLinked ? (
                  <p className="mt-1 truncate text-xs opacity-90 xs:text-sm">@{profile.telegramUsername}</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Stats — clickable orders count navigates to /orders */}
        {profile ? (
          <section className="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-3">
            <Link
              href="/orders"
              className="flex min-w-0 flex-col justify-center rounded-2xl bg-surface-container-lowest p-2 text-center shadow-card transition hover:shadow-glass active:scale-[0.98] xs:p-3 sm:p-4 lg:p-5"
            >
              <p className="font-display text-lg font-extrabold text-primary xs:text-xl sm:text-2xl lg:text-3xl tabular-nums">
                {stats.ordersCount}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant xs:text-[10px] sm:text-xs">
                Заказов
              </p>
            </Link>
            <div className="flex min-w-0 flex-col justify-center rounded-2xl bg-surface-container-lowest p-2 text-center shadow-card xs:p-3 sm:p-4 lg:p-5">
              <p className="font-display text-lg font-extrabold text-emerald-600 xs:text-xl sm:text-2xl lg:text-3xl tabular-nums">
                {stats.deliveredCount}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant xs:text-[10px] sm:text-xs">
                Доставлено
              </p>
            </div>
            <div className="flex min-w-0 flex-col justify-center rounded-2xl bg-surface-container-lowest p-2 text-center shadow-card xs:p-3 sm:p-4 lg:p-5">
              {/* Money string can grow long ("1 234.50"); shrink the digit
                  size further on tiny screens and let it truncate. */}
              <p className="truncate font-display text-xs font-extrabold text-on-surface xs:text-sm sm:text-lg lg:text-2xl tabular-nums">
                {formatMoney(stats.totalSpent)}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant xs:text-[10px] sm:text-xs">
                Потрачено
              </p>
            </div>
          </section>
        ) : null}

        {/* Two-column layout on lg+; single column below. Both columns get
            min-w-0 so cards inside can shrink to the column width — without
            it, grid columns default to min-content and overflow at <380px. */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 space-y-4">
        {/* Linking section */}
        {profile && (!phoneLinked || !telegramLinked) ? (
          <section className="space-y-2 rounded-3xl bg-surface-container-lowest p-4 shadow-card sm:p-5">
            <div className="min-w-0">
              <h2 className="font-display text-base font-extrabold">Привязка аккаунта</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Привяжите оба способа входа, чтобы всегда иметь доступ.
              </p>
            </div>

            {!phoneLinked ? (
              <LinkRow
                icon="phone"
                iconTint="bg-primary/10 text-primary"
                title="Номер телефона"
                subtitle="Ещё не привязан"
                onClick={() => setShowLinkPhone(true)}
              />
            ) : null}

            {!telegramLinked ? (
              <LinkRow
                icon="telegram"
                iconTint="bg-telegram-soft text-telegram"
                title="Telegram"
                subtitle="Ещё не привязан"
                onClick={() => setShowLinkTelegram(true)}
              />
            ) : null}
          </section>
        ) : null}

        {/* Linked contacts */}
        {profile && (phoneLinked || telegramLinked) ? (
          <section className="space-y-2 rounded-3xl bg-surface-container-lowest p-4 shadow-card sm:p-5">
            <h2 className="font-display text-base font-extrabold">Привязанные контакты</h2>
            {phoneLinked ? (
              <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low p-2.5 sm:gap-3 sm:p-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                  <Icon name="phone" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">Номер телефона</p>
                  <p className="truncate font-mono text-xs text-on-surface-variant">+992{profile.phoneNumber}</p>
                </div>
                {/* On phones we drop the chip text and keep only a check
                    badge to free horizontal space; full label returns at sm+. */}
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:hidden">
                  <Icon name="check" size={14} />
                </span>
                <Chip tone="primary" asButton={false} leftIcon="check" className="hidden sm:inline-flex">Активен</Chip>
              </div>
            ) : null}
            {telegramLinked ? (
              <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low p-2.5 sm:gap-3 sm:p-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-telegram-soft text-telegram sm:h-10 sm:w-10">
                  <Icon name="telegram" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">Telegram</p>
                  <p className="truncate text-xs text-on-surface-variant">@{profile.telegramUsername}</p>
                </div>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-tertiary-soft text-tertiary sm:hidden">
                  <Icon name="check" size={14} />
                </span>
                <Chip tone="tertiary" asButton={false} leftIcon="check" className="hidden sm:inline-flex">Подключён</Chip>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Saved delivery addresses */}
        {token ? <SavedAddressesSection token={token} /> : null}
          </div>

          <div className="min-w-0 space-y-4">
        {/* Personal data form */}
        {profile ? (
          <form className="space-y-4 rounded-3xl bg-surface-container-lowest p-5 shadow-card" onSubmit={onSaveProfile}>
            <h2 className="font-display text-base font-extrabold">Личные данные</h2>

            <Input
              label="Имя"
              placeholder="Ваше имя"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Пол</span>
              <Select
                value={editGender}
                onChange={setEditGender}
                options={[
                  { value: "", label: "Не указан" },
                  { value: "1", label: "Мужской" },
                  { value: "2", label: "Женский" },
                ]}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Дата рождения</span>
              <DatePicker value={editDob} onChange={setEditDob} />
            </label>

            {profileMsg ? (
              <div
                className={`rounded-2xl p-3 text-sm font-semibold ${
                  profileMsg.includes("обновлён")
                    ? "bg-accent-mint text-primary"
                    : "bg-secondary/10 text-secondary"
                }`}
              >
                {profileMsg}
              </div>
            ) : null}

            <Button type="submit" size="md" fullWidth loading={isSavingProfile}>
              Сохранить
            </Button>
          </form>
        ) : null}

        {/* Danger zone */}
        {profile ? (
          <section className="space-y-2 rounded-3xl bg-surface-container-lowest p-5 shadow-card">
            <Button variant="secondary" size="md" fullWidth leftIcon="logout" onClick={onLogout}>
              Выйти из аккаунта
            </Button>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 text-center text-xs font-semibold text-on-surface-variant/70 transition hover:text-secondary"
              >
                Удалить аккаунт
              </button>
            ) : (
              <div className="space-y-2 rounded-2xl bg-secondary/10 p-3">
                <p className="text-sm font-bold text-secondary">
                  Уверены? Это действие необратимо.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={onDeleteAccount}
                    loading={isDeleting}
                  >
                    Да, удалить
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}
          </div>
        </div>

        <p className="pb-4 text-center text-[11px] text-on-surface-variant/60">
          © Yalla Farm · Душанбе
        </p>
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

function LinkRow({
  icon,
  iconTint,
  title,
  subtitle,
  onClick,
}: {
  icon: IconName;
  iconTint: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left transition hover:bg-surface-container-high"
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${iconTint}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>
      </div>
      <Icon name="chevron-right" size={18} className="flex-shrink-0 text-on-surface-variant" />
    </button>
  );
}
