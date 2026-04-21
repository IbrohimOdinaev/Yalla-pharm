"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { Icon, Badge, PharmacyLogo } from "@/shared/ui";

type TopBarProps = {
  title: string;
  location?: string;
  backHref?: string;
  homeMode?: boolean;
  onSearchClick?: () => void;
  addressText?: string;
  onAddressClick?: () => void;
  onLogoClick?: () => void;
  pharmacyName?: string;
  pharmacyIconUrl?: string | null;
  pharmacyId?: string | null;
  onPharmacyClick?: () => void;
  showLogout?: boolean;
  /** Hide the search pill in homeMode (used when page itself shows a search UI). */
  hideSearch?: boolean;
};

export function TopBar({
  title,
  backHref,
  homeMode,
  onSearchClick,
  addressText,
  onAddressClick,
  onLogoClick,
  pharmacyName,
  pharmacyIconUrl,
  pharmacyId,
  onPharmacyClick,
  showLogout,
  hideSearch,
}: TopBarProps) {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const serverCartCount = useCartStore((s) => (s.basket.positions ?? []).length);
  const guestCartCount = useGuestCartStore((s) => s.items.length);
  const cartCount = token ? serverCartCount : guestCartCount;

  const goBack = useGoBack();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function onLogout() {
    const wasAdminLike = role === "Admin" || role === "SuperAdmin";
    dispatch(clearCredentials());
    setMenuOpen(false);
    router.push(wasAdminLike ? "/login/admin" : "/login");
  }

  const roleLabels: Record<string, string> = {
    Client: "Клиент",
    Admin: "Администратор",
    SuperAdmin: "Суперадмин",
  };

  // ── HOME MODE: Yandex-style two-row bar ──────────────────────────
  if (homeMode) {
    const LogoBlock = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="Yalla" className="h-10 w-10 flex-shrink-0 sm:h-11 sm:w-11" />
        <span className="hidden font-display text-lg font-extrabold text-on-surface md:block whitespace-nowrap">
          Yalla Farm
        </span>
      </>
    );

    return (
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-xl">
        {/* ROW 1: Logo + Search + Cart + Profile */}
        <div className="flex h-[68px] items-center gap-3 px-4 sm:h-[76px] sm:gap-4 sm:px-6 lg:px-8">
          {onLogoClick ? (
            <button type="button" onClick={onLogoClick} className="flex items-center gap-2 flex-shrink-0">
              {LogoBlock}
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              {LogoBlock}
            </Link>
          )}

          {/* Search — Yandex-style flat filled bar. Pinned to the left half of
              the bar (≈50% of the row width); the gap between it and the cart
              icons is intentional whitespace. Hidden when page owns its own
              search UI. */}
          {!hideSearch ? (
            onSearchClick ? (
              <button
                type="button"
                onClick={onSearchClick}
                className="flex h-12 w-1/2 shrink-0 min-w-0 items-center gap-3 rounded-full bg-surface-container px-5 text-left transition hover:bg-surface-container-high sm:h-[52px]"
              >
                <Icon name="search" size={20} className="flex-shrink-0 text-on-surface" />
                <span className="truncate text-sm text-on-surface-variant sm:text-base">
                  Найти лекарства, витамины, тесты
                </span>
                <Icon name="mic" size={20} className="flex-shrink-0 text-on-surface/70" />
              </button>
            ) : (
              <Link
                href="/?search="
                className="flex h-12 w-1/2 shrink-0 min-w-0 items-center gap-3 rounded-full bg-surface-container px-5 text-left transition hover:bg-surface-container-high sm:h-[52px]"
              >
                <Icon name="search" size={20} className="flex-shrink-0 text-on-surface" />
                <span className="truncate text-sm text-on-surface-variant sm:text-base">
                  Найти лекарства, витамины, тесты
                </span>
                <Icon name="mic" size={20} className="flex-shrink-0 text-on-surface/70" />
              </Link>
            )
          ) : null}

          {/* Flex spacer — pushes cart + profile to the far right, leaving the
              whitespace between search and actions that the design calls for. */}
          <span className="flex-1" />

          {/* Cart (always visible) */}
          <Link
            href="/cart"
            className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high sm:h-[52px] sm:w-[52px]"
            aria-label="Корзина"
          >
            <Icon name="bag" size={22} />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5">
                <Badge tone="secondary">{cartCount}</Badge>
              </span>
            ) : null}
          </Link>

          {/* Profile */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-surface-container transition hover:bg-surface-container-high sm:h-[52px] sm:w-[52px]"
              aria-label="Аккаунт"
            >
              <Icon name="user" size={22} />
              {token ? (
                <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" />
              ) : null}
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-12 z-50 w-60 max-w-[85vw] rounded-2xl border border-outline/70 bg-surface-container-lowest p-2 shadow-float animate-in">
                {token ? (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {roleLabels[role ?? ""] ?? "Пользователь"}
                      </p>
                    </div>
                    {role !== "SuperAdmin" ? (
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                      >
                        <Icon name="user" size={16} />
                        Мой профиль
                      </Link>
                    ) : null}
                    {role === "Client" ? (
                      <Link
                        href="/orders"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                      >
                        <Icon name="orders" size={16} />
                        Мои заказы
                      </Link>
                    ) : null}
                    {role === "Admin" ? (
                      <Link
                        href="/workspace"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                      >
                        <Icon name="settings" size={16} />
                        Кабинет
                      </Link>
                    ) : null}
                    {role === "SuperAdmin" ? (
                      <Link
                        href="/superadmin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                      >
                        <Icon name="settings" size={16} />
                        Панель управления
                      </Link>
                    ) : null}
                    <div className="my-1 h-px bg-outline/50" />
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-secondary transition hover:bg-secondary-soft"
                    >
                      <Icon name="logout" size={16} />
                      Выйти
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Гостевой режим
                      </p>
                    </div>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft"
                    >
                      <Icon name="login" size={16} />
                      Войти по SMS
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* ROW 2: Address + Pharmacy pill strip */}
        <div className="hair-divider" />
        <div className="flex h-14 items-center gap-2.5 overflow-x-auto scrollbar-hide scroll-touch px-4 sm:h-[60px] sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onAddressClick}
            className="flex flex-shrink-0 items-center gap-2 rounded-full bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            <Icon name="pin" size={16} className="text-secondary" />
            <span className="truncate max-w-[180px] sm:max-w-[260px]">
              {addressText || "Выберите адрес"}
            </span>
            <Icon name="chevron-down" size={14} className="text-on-surface-variant" />
          </button>
          <button
            type="button"
            onClick={onPharmacyClick}
            className="flex flex-shrink-0 items-center gap-2 rounded-full bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            <PharmacyLogo
              pharmacyId={pharmacyId ?? undefined}
              iconUrl={pharmacyIconUrl}
              size={22}
              className="flex-shrink-0"
            />
            <span className="truncate max-w-[160px] sm:max-w-[220px]">
              {pharmacyName || "Все аптеки"}
            </span>
            <Icon name="chevron-down" size={14} className="text-on-surface-variant" />
          </button>
        </div>
        <div className="hair-divider" />
      </header>
    );
  }

  // ── DEFAULT MODE: back + title ───────────────────────────────────
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            backHref === "back" ? (
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                aria-label="Назад"
              >
                <Icon name="back" size={16} />
              </button>
            ) : (
              <Link
                href={backHref}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                aria-label="Назад"
              >
                <Icon name="back" size={16} />
              </Link>
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-icon.png" alt="Yalla" className="h-7 w-7 flex-shrink-0" />
          )}
          <h1 className="truncate font-display text-base font-extrabold text-on-surface">{title}</h1>
        </div>
        {showLogout && token ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary-soft"
            aria-label="Выйти"
          >
            <Icon name="logout" size={14} />
            <span className="hidden xs:inline">Выйти</span>
          </button>
        ) : null}
      </div>
      <div className="hair-divider" />
    </header>
  );
}
