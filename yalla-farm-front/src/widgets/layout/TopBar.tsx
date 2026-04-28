"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect, useMemo, type RefObject } from "react";
import { useAppSelector, useAppDispatch } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useGuestPharmacyOptions } from "@/features/cart/model/useGuestPharmacyOptions";
import { computeBestPriceFromPharmacyOptions } from "@/features/cart/model/bestPharmacyPrice";
import { formatMoney } from "@/shared/lib/format";
import { Icon, PharmacyLogo } from "@/shared/ui";

type TopBarProps = {
  title: string;
  location?: string;
  backHref?: string;
  homeMode?: boolean;
  onSearchClick?: () => void;
  addressText?: string;
  /** User-defined label for the active delivery address ("Дом", "Работа").
   *  When non-empty it's shown in place of the raw street, in black, so the
   *  user recognises their saved place at a glance. */
  addressTitle?: string;
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
  addressTitle,
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
  // Two refs because the profile button is rendered twice (mobile + desktop
  // layouts); click-outside must treat both subtrees as "inside".
  const menuRefDesktop = useRef<HTMLDivElement>(null);
  const menuRefMobile = useRef<HTMLDivElement>(null);

  const serverBasket = useCartStore((s) => s.basket);
  const guestCartCount = useGuestCartStore((s) => s.items.length);
  const serverCartCount = (serverBasket.positions ?? []).length;
  const cartCount = token ? serverCartCount : guestCartCount;
  const guestPharmacyOptions = useGuestPharmacyOptions();

  const bestPrice = useMemo(() => {
    if (token) {
      return computeBestPriceFromPharmacyOptions(
        serverBasket.pharmacyOptions,
        serverCartCount,
      );
    }
    return computeBestPriceFromPharmacyOptions(
      guestPharmacyOptions,
      guestCartCount,
    );
  }, [
    token,
    serverBasket.pharmacyOptions,
    serverCartCount,
    guestPharmacyOptions,
    guestCartCount,
  ]);

  const goBack = useGoBack();

  // Hide every cart-button surface on routes that already are the cart /
  // checkout — the redundant CTA looks weird when the user is literally on
  // the cart screen.
  const pathname = usePathname();
  const onCartRoute =
    pathname === "/cart" ||
    pathname === "/cart/pharmacy" ||
    pathname === "/checkout";

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideDesktop = menuRefDesktop.current?.contains(target) ?? false;
      const insideMobile = menuRefMobile.current?.contains(target) ?? false;
      if (!insideDesktop && !insideMobile) setMenuOpen(false);
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

  // ── HOME MODE: Yandex-style bar. lg+ keeps the single-row layout with
  //    inline address/pharmacy pills; below lg switches to a two-row layout
  //    (logo + full address + profile / full-width search). The pharmacy
  //    selector moves out of the header on mobile and lives as the last
  //    card in PharmacyBanners.
  if (homeMode) {
    const LogoBlock = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="Yalla" className="h-9 w-9 flex-shrink-0 sm:h-10 sm:w-10" />
        <span className="hidden font-display text-base font-extrabold text-on-surface xl:block whitespace-nowrap">
          Yalla Farm
        </span>
      </>
    );

    const LogoLink = onLogoClick ? (
      <button type="button" onClick={onLogoClick} className="flex items-center gap-2 flex-shrink-0">
        {LogoBlock}
      </button>
    ) : (
      <Link href="/" className="flex items-center gap-2 flex-shrink-0">
        {LogoBlock}
      </Link>
    );

    const DesktopAddressPill = (
      <button
        type="button"
        onClick={onAddressClick}
        className="flex flex-shrink items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container sm:text-sm sm:px-3.5"
        title={addressTitle ? addressText : undefined}
      >
        <Icon name="pin" size={14} className="flex-shrink-0 text-secondary" />
        <span className="truncate max-w-[120px] sm:max-w-[160px] lg:max-w-[140px] xl:max-w-[200px] text-on-surface">
          {addressTitle || addressText || "Выберите адрес"}
        </span>
        <Icon name="chevron-down" size={12} className="flex-shrink-0 text-on-surface-variant" />
      </button>
    );

    const PharmacyPill = (
      <button
        type="button"
        onClick={onPharmacyClick}
        className="flex flex-shrink items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container sm:text-sm sm:px-3.5"
      >
        <PharmacyLogo
          pharmacyId={pharmacyId ?? undefined}
          iconUrl={pharmacyIconUrl}
          size={18}
          className="flex-shrink-0"
        />
        <span className="truncate max-w-[110px] sm:max-w-[140px] lg:max-w-[120px] xl:max-w-[180px]">
          {pharmacyName || "Все аптеки"}
        </span>
        <Icon name="chevron-down" size={12} className="flex-shrink-0 text-on-surface-variant" />
      </button>
    );

    // Mobile header column next to the logo — two stacked, INDEPENDENTLY
    // clickable rows so the brand label opens "/" while the address row opens
    // the address picker. Previously a single button wrapped both, which made
    // tapping "Yalla Farm" trigger the address modal.
    const MobileBrandAndAddress = (
      <div className="-mx-1 flex min-w-0 flex-1 flex-col items-start px-1 py-0.5">
        {onLogoClick ? (
          <button
            type="button"
            onClick={onLogoClick}
            className="font-display text-base xs:text-lg font-extrabold leading-tight text-on-surface sm:text-xl rounded transition active:bg-surface-container-low/70"
          >
            Yalla Farm
          </button>
        ) : (
          <Link
            href="/"
            className="font-display text-base xs:text-lg font-extrabold leading-tight text-on-surface sm:text-xl rounded transition active:bg-surface-container-low/70"
          >
            Yalla Farm
          </Link>
        )}
        <button
          type="button"
          onClick={onAddressClick}
          className="mt-0.5 flex w-full min-w-0 items-center gap-1 rounded text-[11px] xs:text-xs sm:text-sm transition active:bg-surface-container-low/70"
          title={addressTitle ? addressText : undefined}
        >
          {/* Pin icon — makes the row read as an address even when only a
              short user label ("Kulob") is shown. */}
          <Icon name="pin" size={12} className="flex-shrink-0 text-secondary" />
          <span
            className={`min-w-0 truncate ${addressTitle ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
          >
            {addressTitle || addressText || "Выберите адрес"}
          </span>
          <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-on-surface text-surface">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      </div>
    );

    const SearchInner = (
      <>
        <Icon name="search" size={18} className="flex-shrink-0 text-on-surface" />
        <span className="truncate text-xs text-on-surface-variant sm:text-sm">
          Найти лекарства, витамины, тесты
        </span>
      </>
    );

    const DesktopSearch = !hideSearch ? (
      onSearchClick ? (
        <button
          type="button"
          onClick={onSearchClick}
          className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface-container px-5 text-left transition hover:bg-surface-container-high lg:max-w-[420px]"
        >
          {SearchInner}
        </button>
      ) : (
        <Link
          href="/?search="
          className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface-container px-5 text-left transition hover:bg-surface-container-high lg:max-w-[420px]"
        >
          {SearchInner}
        </Link>
      )
    ) : null;

    const MobileSearch = !hideSearch ? (
      onSearchClick ? (
        <button
          type="button"
          onClick={onSearchClick}
          className="flex h-11 w-full items-center gap-3 rounded-full bg-surface-container px-5 text-left transition hover:bg-surface-container-high"
        >
          {SearchInner}
        </button>
      ) : (
        <Link
          href="/?search="
          className="flex h-11 w-full items-center gap-3 rounded-full bg-surface-container px-5 text-left transition hover:bg-surface-container-high"
        >
          {SearchInner}
        </Link>
      )
    ) : null;

    // Inline cart button — used in both the desktop block and the mobile
    // block. Both states are hidden below `sm` so phone screens never see
    // the in-header pill (the floating pill below covers phones). The outer
    // block's `lg:flex` / `lg:hidden` then gates further; effectively:
    //   • desktop block: visible at lg+
    //   • mobile block:  visible at sm..md
    const CartButton =
      cartCount > 0 ? (
        <Link
          href="/cart"
          aria-label={
            bestPrice
              ? `Корзина, от ${formatMoney(bestPrice.price)}`
              : `Корзина, ${cartCount} товаров`
          }
          className="relative hidden h-10 flex-shrink-0 items-center gap-1.5 rounded-full bg-[#3FC5C4] px-3 text-on-surface shadow-card transition hover:bg-[#35B7B6] active:scale-[0.98] sm:flex sm:h-11 sm:gap-2 sm:px-4"
        >
          <Icon name="bag" size={18} strokeWidth={2.2} />
          <span className="font-display text-xs font-extrabold tabular-nums sm:text-sm">
            {bestPrice ? `от ${formatMoney(bestPrice.price)}` : `${cartCount}`}
          </span>
        </Link>
      ) : (
        // Empty state — keep the same brand-cyan capsule as the populated
        // state so the cart action stays visually anchored on the bar.
        <Link
          href="/cart"
          className="relative hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3FC5C4] text-on-surface shadow-card transition hover:bg-[#35B7B6] active:scale-[0.98] sm:flex sm:h-11 sm:w-11"
          aria-label="Корзина"
        >
          <Icon name="bag" size={20} strokeWidth={2.2} />
        </Link>
      );

    const renderProfileButton = (ref: RefObject<HTMLDivElement | null>) => (
      <div className="relative flex-shrink-0" ref={ref}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container transition hover:bg-surface-container-high sm:h-11 sm:w-11"
          aria-label="Аккаунт"
        >
          <Icon name="user" size={20} />
          {token ? (
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" />
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
                  <>
                    <Link
                      href="/cart"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                    >
                      <Icon name="bag" size={16} />
                      Корзина
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                    >
                      <Icon name="orders" size={16} />
                      Мои заказы
                    </Link>
                  </>
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
                  href="/cart"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                >
                  <Icon name="bag" size={16} />
                  Корзина
                </Link>
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
    );

    return (
      <>
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1440px]">
          {/* DESKTOP (lg+): single row with inline pills. */}
          <div className="hidden h-[60px] items-center gap-3 px-5 lg:flex lg:px-8">
            {LogoLink}
            {DesktopSearch}
            <div className="flex items-center gap-2 min-w-0">
              {DesktopAddressPill}
              {PharmacyPill}
            </div>
            <span className="flex-1" />
            {!onCartRoute ? CartButton : null}
            {renderProfileButton(menuRefDesktop)}
          </div>

          {/* MOBILE (< lg): two rows — logo+address+(cart sm+)+profile, then
              wide search. The inline cart fills the gap left by the floating
              pill, which is phone-only. */}
          <div className="lg:hidden">
            <div className="flex items-center gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
              {LogoLink}
              {MobileBrandAndAddress}
              {!onCartRoute ? CartButton : null}
              {renderProfileButton(menuRefMobile)}
            </div>
            {MobileSearch ? (
              <div className="px-3 pb-3 sm:px-6 sm:pb-4">
                {MobileSearch}
              </div>
            ) : null}
          </div>
        </div>
        <div className="hair-divider" />
      </header>

      {/* Floating cart — phone only (sm:hidden), shown when basket has
          items and the user isn't already on /cart or /checkout. */}
      {!onCartRoute && cartCount > 0 ? (
        <Link
          href="/cart"
          aria-label={
            bestPrice
              ? `Корзина, от ${formatMoney(bestPrice.price)}`
              : `Корзина, ${cartCount} товаров`
          }
          className="fixed bottom-6 right-4 z-40 flex h-10 items-center gap-1.5 rounded-full bg-[#3FC5C4] px-3 text-on-surface shadow-card transition hover:bg-[#35B7B6] active:scale-[0.98] safe-bottom sm:hidden"
        >
          <Icon name="bag" size={18} strokeWidth={2.2} />
          <span className="font-display text-xs font-extrabold tabular-nums">
            {bestPrice
              ? `от ${formatMoney(bestPrice.price)}`
              : `${cartCount}`}
          </span>
        </Link>
      ) : null}
      </>
    );
  }

  // ── DEFAULT MODE: back + title ───────────────────────────────────
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
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
