"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useRef, useEffect, useMemo, type RefObject } from "react";
import { useAppSelector, useAppDispatch } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useGuestPharmacyOptions } from "@/features/cart/model/useGuestPharmacyOptions";
import { computeBestPriceFromPharmacyOptions } from "@/features/cart/model/bestPharmacyPrice";
import { getCachedMedicineByIdOrSlug, getCheapestPrice } from "@/entities/medicine/api";
import { getClientOrderHistory } from "@/entities/order/api";
import {
  getMyPrescriptions,
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
  type PrescriptionStatus,
} from "@/entities/prescription/api";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { formatMoney } from "@/shared/lib/format";
import type { ApiMedicine, ApiOrder } from "@/shared/types/api";
import { Icon } from "@/shared/ui";

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
  showLogout?: boolean;
  /** Hide the search pill in homeMode (used when page itself shows a search UI). */
  hideSearch?: boolean;
  /** Hide only the mobile search row while keeping the desktop search visible. */
  hideMobileSearch?: boolean;
  /** Show the "Отправить рецепт" CTA in the desktop header next to
   *  the pharmacy pill. Hidden below xl (1280px) so the home page falls back
   *  to its own banner under the quick-categories rail at narrower widths. */
  showPrescriptionCta?: boolean;
};

function formatAddressDisplay(address?: string): string {
  const value = String(address ?? "").trim();
  if (!value) return "";
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return value;
  return parts.reverse().join(", ");
}

export function TopBar({
  title,
  backHref,
  homeMode,
  onSearchClick,
  addressText,
  addressTitle,
  onAddressClick,
  onLogoClick,
  showLogout,
  hideSearch,
  hideMobileSearch,
  showPrescriptionCta,
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
  const activityCounts = useClientActivityCounts(token, role);

  const serverBasket = useCartStore((s) => s.basket);
  const guestCartCount = useGuestCartStore((s) => s.items.length);
  const guestItems = useGuestCartStore((s) => s.items);
  const serverCartCount = (serverBasket.positions ?? []).length;
  const cartCount = token ? serverCartCount : guestCartCount;
  const guestPharmacyOptions = useGuestPharmacyOptions();

  const bestPrice = useMemo(() => {
    // Pass current local positions so the price recomputes in the same
    // frame as an optimistic +/− click — without this we read the stale
    // `totalCost` the server emitted *before* the mutation and the pill
    // amount visibly lags by one network round-trip behind the dot count.
    if (token) {
      return computeBestPriceFromPharmacyOptions(
        serverBasket.pharmacyOptions,
        serverCartCount,
        serverBasket.positions,
      );
    }
    return computeBestPriceFromPharmacyOptions(
      guestPharmacyOptions,
      guestCartCount,
      guestItems,
    );
  }, [
    token,
    serverBasket.pharmacyOptions,
    serverBasket.positions,
    serverCartCount,
    guestPharmacyOptions,
    guestItems,
    guestCartCount,
  ]);
  const cartPositionsForTotal = useMemo<ReadonlyArray<{
    medicineId: string;
    quantity: number;
    price?: number;
    medicine?: ApiMedicine;
  }>>(
    () => token
      ? (serverBasket.positions ?? []).map((p) => ({
          medicineId: p.medicineId,
          quantity: p.quantity,
          price: p.price,
          medicine: p.medicine,
        }))
      : guestItems.map((p) => ({ medicineId: p.medicineId, quantity: p.quantity })),
    [token, serverBasket.positions, guestItems],
  );
  const optimisticCartPrice = useMemo(() => {
    if (cartPositionsForTotal.length === 0) return null;
    let total = 0;
    for (const position of cartPositionsForTotal) {
      const medicine = position.medicine ?? getCachedMedicineByIdOrSlug(position.medicineId);
      const price = (position.price && position.price > 0)
        ? position.price
        : getCheapestPrice(medicine ?? undefined);
      if (!price || price <= 0) return null;
      total += price * Math.max(1, position.quantity);
    }
    return total > 0 ? total : null;
  }, [cartPositionsForTotal]);
  const cartDisplayPrice = optimisticCartPrice ?? bestPrice?.price;

  const goBack = useGoBack();

  // Hide every cart-button surface on routes that already are the cart /
  // checkout — the redundant CTA looks weird when the user is literally on
  // the cart screen.
  const pathname = usePathname();
  // Hide the floating mobile cart pill on:
  //  • cart / checkout pages — the CTA is already on screen, a second
  //    floating copy looks weird and steals taps from the checkout flow.
  //  • auth pages — the user isn't shopping right now; the floating
  //    cart overlays the phone-input field on small screens and gets in
  //    the way of typing the OTP / signing in.
  const onCartRoute =
    pathname === "/cart" ||
    pathname === "/cart/pharmacy" ||
    pathname === "/checkout" ||
    pathname === "/login" ||
    pathname === "/login/admin" ||
    pathname === "/register" ||
    pathname.startsWith("/product/");
  const floatingCartLabel = bestPrice
    ? `от ${formatMoney(cartDisplayPrice ?? bestPrice.price)}`
    : cartDisplayPrice != null
      ? `от ${formatMoney(cartDisplayPrice)}`
      : `${cartCount}`;
  const displayAddressText = formatAddressDisplay(addressText);

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
    const wasAdminLike = role === "Admin" || role === "PharmacyAccount" || role === "SuperAdmin";
    dispatch(clearCredentials());
    setMenuOpen(false);
    // Admin/SuperAdmin → home via replace so the admin URL leaves the history
    // stack and the browser Back button can't bounce the user into the now-
    // unauthorized workspace/superadmin page. Client logout keeps the login
    // route as the natural next step.
    if (wasAdminLike) {
      router.replace("/");
    } else {
      router.push("/login");
    }
  }

  const roleLabels: Record<string, string> = {
    Client: "Клиент",
    Admin: "Администратор",
    SuperAdmin: "Суперадмин",
  };

  // ── HOME MODE: Yandex-style bar. lg+ keeps the single-row layout with
  //    inline address/action pills; below lg switches to a two-row layout
  //    (logo + full address + profile / full-width search). The pharmacy
  //    selector moves out of the header on mobile and lives as the last
  //    card in PharmacyBanners.
  if (homeMode) {
    const FullLogo = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/for-pharmacies-assets/yal.png"
        alt="Yalla Pharm"
        className="-my-4 h-20 w-auto flex-shrink-0 object-contain sm:-my-5 sm:h-24"
      />
    );

    const LogoMark = (
      <span className="relative block h-9 w-10 flex-shrink-0 overflow-hidden sm:h-10 sm:w-11" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/for-pharmacies-assets/yal.png"
          alt=""
          className="absolute -left-[17px] -top-[28px] h-[92px] w-auto max-w-none object-contain sm:-left-[18px] sm:-top-[30px] sm:h-[100px]"
        />
      </span>
    );

    const LogoText = (
      <span className="relative block h-6 w-[164px] max-w-full flex-shrink-0 overflow-hidden sm:h-7 sm:w-[180px]" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/for-pharmacies-assets/yal.png"
          alt=""
          className="absolute -left-[68px] -top-[35px] h-[100px] w-auto max-w-none object-contain sm:-left-[75px] sm:-top-[39px] sm:h-[110px]"
        />
      </span>
    );

    const LogoLink = onLogoClick ? (
      <button type="button" onClick={onLogoClick} className="flex flex-shrink-0 items-center gap-2">
        {FullLogo}
      </button>
    ) : (
      <Link href="/" className="flex flex-shrink-0 items-center gap-2">
        {FullLogo}
      </Link>
    );

    const DesktopAddressPill = (
      <button
        type="button"
        onClick={onAddressClick}
        className="flex flex-shrink items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-2 text-xs font-semibold text-on-surface transition active:scale-95 hover:bg-surface-container"
        title={addressTitle ? addressText : undefined}
      >
        <Icon name="pin" size={14} className="flex-shrink-0 text-secondary" />
        {/* Address text capped 20% tighter than before so the search
            bar has more room to breathe. Long addresses still fit
            with ellipsis; the full string lives in the title hover. */}
        <span className="truncate max-w-[84px] lg:max-w-[96px] 2xl:max-w-[140px] text-on-surface">
          {addressTitle || displayAddressText || "Выберите адрес"}
        </span>
        <Icon name="chevron-down" size={12} className="flex-shrink-0 text-on-surface-variant" />
      </button>
    );

    const renderPrescriptionPill = (className = "") => showPrescriptionCta ? (
      <Link
        href="/prescriptions/new"
        title="Отправить рецепт · фармацевт расшифрует и пришлёт готовый список лекарств · 3 TJS"
        className={`flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full border border-secondary/25 bg-secondary-soft px-3 text-xs font-semibold text-secondary transition active:scale-95 hover:bg-secondary/15 ${className}`}
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-on-primary">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="14" x2="15" y2="14" />
            <line x1="12" y1="11" x2="12" y2="17" />
          </svg>
        </span>
        <span className="whitespace-nowrap">Отправить рецепт</span>
      </Link>
    ) : null;

    // Mobile header column next to the logo. Keep the address picker separate
    // so tapping the logo can still navigate home.
    const MobileLogoMarkLink = onLogoClick ? (
      <button type="button" onClick={onLogoClick} className="flex flex-shrink-0 items-center" aria-label="Yalla Pharm">
        {LogoMark}
      </button>
    ) : (
      <Link href="/" className="flex flex-shrink-0 items-center" aria-label="Yalla Pharm">
        {LogoMark}
      </Link>
    );

    const MobileLogoTextLink = onLogoClick ? (
      <button type="button" onClick={onLogoClick} className="flex max-w-full items-center" aria-label="Yalla Pharm">
        {LogoText}
      </button>
    ) : (
      <Link href="/" className="flex max-w-full items-center" aria-label="Yalla Pharm">
        {LogoText}
      </Link>
    );

    const MobileLogoAndAddress = (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {MobileLogoMarkLink}
        <div className="flex min-w-0 flex-1 flex-col items-start">
          {MobileLogoTextLink}
          <button
            type="button"
            onClick={onAddressClick}
            className="mt-0.5 flex max-w-full min-w-0 items-center gap-1 rounded text-[11px] leading-tight transition active:bg-surface-container-low/70 xs:text-xs sm:text-sm"
            title={addressTitle ? addressText : undefined}
          >
            {/* Pin icon — makes the row read as an address even when only a
                short user label ("Kulob") is shown. */}
            <Icon name="pin" size={12} className="flex-shrink-0 text-secondary" />
            <span
              className={`min-w-0 truncate ${addressTitle ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
            >
              {addressTitle || displayAddressText || "Выберите адрес"}
            </span>
            <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-on-surface text-surface">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>
        </div>
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
    const desktopSearchClass =
      "-ml-6 flex h-12 min-w-[286px] flex-[1.3_1_0%] items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition active:scale-95 hover:bg-surface-container-highest xl:-ml-5 xl:min-w-[468px] 2xl:max-w-[936px]";

    // Desktop search flexes inside the single-line header. A minimum width
    // keeps the input readable while letting the action buttons stay inline
    // on 1440-1680px laptop/browser-devtools viewports.
    const DesktopSearch = !hideSearch ? (
      onSearchClick ? (
        <button
          type="button"
          onClick={onSearchClick}
          className={desktopSearchClass}
        >
          {SearchInner}
        </button>
      ) : (
        <Link
          href="/?search="
          className={desktopSearchClass}
        >
          {SearchInner}
        </Link>
      )
    ) : null;

    const MobileSearch = !hideSearch && !hideMobileSearch ? (
      onSearchClick ? (
        <button
          type="button"
          onClick={onSearchClick}
          className="flex h-11 w-full items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition active:scale-95 hover:bg-surface-container-highest"
        >
          {SearchInner}
        </button>
      ) : (
        <Link
          href="/?search="
          className="flex h-11 w-full items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition active:scale-95 hover:bg-surface-container-highest"
        >
          {SearchInner}
        </Link>
      )
    ) : null;

    const cartFilled = cartCount > 0;
    const renderCartButton = (className = "") => (
      <Link
        href="/cart"
        aria-label={
          cartFilled
            ? (bestPrice
                ? `Корзина, от ${formatMoney(cartDisplayPrice ?? bestPrice.price)}`
                : cartDisplayPrice != null
                  ? `Корзина, от ${formatMoney(cartDisplayPrice)}`
                : `Корзина, ${cartCount} товаров`)
            : "Корзина"
        }
        className={`h-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-white shadow-card transition-[width,padding,background-color,transform] duration-150 hover:bg-secondary-container active:scale-[0.98] sm:h-12 ${
          cartFilled
            ? "w-auto gap-2 px-5 sm:gap-2.5 sm:px-6"
            : "w-11 gap-0 px-0 sm:w-12"
        } ${className}`}
      >
        <Icon name="bag" size={20} strokeWidth={cartFilled ? 2.4 : 2.2} className="flex-shrink-0" />
        <span
          className={`overflow-hidden whitespace-nowrap font-display text-sm font-black tabular-nums transition-[max-width,opacity] duration-150 sm:text-[15px] ${
            cartFilled ? "max-w-[190px] opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          {cartFilled ? (cartDisplayPrice != null ? `от ${formatMoney(cartDisplayPrice)}` : `${cartCount}`) : ""}
        </span>
      </Link>
    );

    const LatestActivity = <LatestClientActivityButton />;

    const renderMenuCount = (count: number) => (
      count > 0 ? (
        <span className="ml-2 inline-flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null
    );

    const renderProfileButton = (ref: RefObject<HTMLDivElement | null>) => (
      <div className="relative flex-shrink-0" ref={ref}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container transition hover:bg-surface-container-high active:scale-95 sm:h-11 sm:w-11"
          aria-label="Аккаунт"
        >
          <Icon name="user" size={20} />
          {token ? (
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-secondary ring-2 ring-surface" />
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
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
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
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
                    >
                      <Icon name="bag" size={16} />
                      Корзина
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon name="orders" size={16} className="flex-shrink-0" />
                        <span className="truncate">Мои заказы</span>
                      </span>
                      {renderMenuCount(activityCounts.orders)}
                    </Link>
                    <Link
                      href="/prescriptions"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon name="orders" size={16} className="flex-shrink-0" />
                        <span className="truncate">Мои рецепты</span>
                      </span>
                      {renderMenuCount(activityCounts.prescriptions)}
                    </Link>
                  </>
                ) : null}
                {role === "Admin" || role === "PharmacyAccount" ? (
                  <Link
                    href="/workspace"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
                  >
                    <Icon name="settings" size={16} />
                    Кабинет
                  </Link>
                ) : null}
                {role === "SuperAdmin" ? (
                  <Link
                    href="/superadmin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
                  >
                    <Icon name="settings" size={16} />
                    Панель управления
                  </Link>
                ) : null}
                <div className="my-1 h-px bg-outline/50" />
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-secondary transition active:scale-95 hover:bg-secondary-soft"
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
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-surface-container"
                >
                  <Icon name="bag" size={16} />
                  Корзина
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary transition active:scale-95 hover:bg-primary-soft"
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
        <div className="w-full px-3 sm:px-6 lg:px-12">
          {/* DESKTOP (lg+): single row. Order requested:
              logo / search / address + prescription / … / cart / profile.
              Prescription pill is now part of the left/centre cluster
              (flush against the address pill); cart + profile sit at the
              right edge separated by a flex-1 spacer. */}
          <div className="hidden lg:block">
            <div className="flex h-[66px] min-w-0 items-center gap-2 2xl:gap-3">
              {LogoLink}
              {DesktopSearch}
              <div className="flex flex-shrink-0 items-center gap-2">
                {DesktopAddressPill}
                {renderPrescriptionPill("hidden xl:flex")}
              </div>
              <span className="flex-1" />
              {LatestActivity}
              {!onCartRoute ? renderCartButton("inline-flex") : null}
              {renderProfileButton(menuRefDesktop)}
            </div>
          </div>

          {/* MOBILE/TABLET (< lg): two rows — logo+address+activity+profile,
              then wide search. Cart moves to the floating bottom pill. */}
          <div className="lg:hidden">
            <div className="flex items-center gap-3 py-2.5 sm:py-3">
              {MobileLogoAndAddress}
              {LatestActivity}
              {renderProfileButton(menuRefMobile)}
            </div>
            {MobileSearch ? (
              <div className="pb-3 sm:pb-4">
                {MobileSearch}
              </div>
            ) : null}
          </div>
        </div>
        <div className="hair-divider" />
      </header>

      {/* Floating cart — mobile/tablet only (lg:hidden), shown when basket has
          items and the user isn't already on /cart or /checkout.
          Size the pill from the icon+label group and keep that whole group
          centered. CSS bottom anchoring avoids the iOS visualViewport jump
          that made the pill drift upward while browser chrome changed. */}
      {!onCartRoute && cartCount > 0 ? (
        <Link
          href="/cart"
          aria-label={
            bestPrice
              ? `Корзина, от ${formatMoney(cartDisplayPrice ?? bestPrice.price)}`
              : cartDisplayPrice != null
                ? `Корзина, от ${formatMoney(cartDisplayPrice)}`
              : `Корзина, ${cartCount} товаров`
          }
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-40 inline-grid h-14 min-w-[176px] max-w-[calc(100vw-1.5rem)] place-items-center overflow-hidden rounded-full bg-[#D4484C] px-7 py-0 text-white shadow-card transition-[background-color,transform] ease-out hover:bg-[#C13D42] active:bg-[#D4484C] active:scale-[0.98] lg:hidden"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          <span
            aria-hidden="true"
            className="invisible flex items-center gap-5 whitespace-nowrap font-display text-base font-black tabular-nums"
          >
            <Icon name="bag" size={26} strokeWidth={2.4} />
            <span>{floatingCartLabel}</span>
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-5 px-7">
            <Icon name="bag" size={26} strokeWidth={2.4} className="flex-shrink-0" />
            <span className="block max-w-[calc(100vw-8.5rem)] overflow-hidden whitespace-nowrap text-center font-display text-base font-black tabular-nums">
              {floatingCartLabel}
            </span>
          </span>
        </Link>
      ) : null}
      </>
    );
  }

  // ── DEFAULT MODE: back + title ───────────────────────────────────
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            backHref === "back" ? (
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition active:scale-95 hover:bg-surface-container-high"
                aria-label="Назад"
              >
                <Icon name="back" size={16} />
              </button>
            ) : (
              <Link
                href={backHref}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition active:scale-95 hover:bg-surface-container-high"
                aria-label="Назад"
              >
                <Icon name="back" size={16} />
              </Link>
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-icon.png" alt="Yalla" className="h-7 w-7 flex-shrink-0 object-contain" />
          )}
          <h1 className="truncate font-display text-base font-extrabold text-on-surface">{title}</h1>
        </div>
        {showLogout && token ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-secondary transition active:scale-95 hover:bg-secondary-soft"
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

type LatestClientActivity =
  | {
      kind: "order";
      id: string;
      status: string;
      createdAtUtc: string;
    }
  | {
      kind: "prescription";
      id: string;
      status: PrescriptionStatus;
      createdAtUtc: string;
    };

const ORDER_STATUS_LABEL_RU: Record<string, string> = {
  New: "Новый заказ",
  UnderReview: "Проверяется",
  Preparing: "Готовится",
  Ready: "Готов",
  OnTheWay: "В пути",
  Delivered: "Доставлен",
  Cancelled: "Отменён",
  Returned: "Возврат",
  PickedUp: "Получен",
  DriverArrived: "Курьер на месте",
};

const ACTIVE_PRESCRIPTION_STATUSES: ReadonlySet<PrescriptionStatus> = new Set([
  "Submitted",
  "AwaitingConfirmation",
  "InQueue",
  "InReview",
  "Decoded",
]);

const ACTIVE_ORDER_STATUSES: ReadonlySet<string> = new Set([
  "New",
  "UnderReview",
  "Preparing",
  "Ready",
  "DriverArrived",
  "OnTheWay",
]);

const ACTIVE_MENU_ORDER_STATUSES: ReadonlySet<string> = new Set([
  "New",
  "UnderReview",
  "Preparing",
  "Ready",
  "DriverArrived",
  "OnTheWay",
]);

const PRESCRIPTION_PROGRESS_STAGES: PrescriptionStatus[] = [
  "Submitted",
  "AwaitingConfirmation",
  "InQueue",
  "InReview",
  "Decoded",
];

const ORDER_PROGRESS_STAGES = [
  "New",
  "UnderReview",
  "Preparing",
  "Ready",
  "DriverArrived",
  "OnTheWay",
  "Delivered",
] as const;

function stageProgress<T extends string>(stages: readonly T[], status: T, aliases?: Partial<Record<T, T>>) {
  const effectiveStatus = aliases?.[status] ?? status;
  const idx = stages.indexOf(effectiveStatus);
  return idx >= 0 ? (idx + 1) / stages.length : 1 / stages.length;
}

const ACTIVITY_PROGRESS_COLOR = "#D4484C";
const ACTIVITY_PROGRESS_TRACK = "#DDE7EA";

function isAwaitingPayment(order: ApiOrder): boolean {
  if (["Cancelled", "Delivered", "PickedUp", "Returned"].includes(order.status)) return false;
  return order.paymentState === "PendingManualConfirmation" || String(order.paymentState) === "1";
}

function isMenuActiveOrder(order: ApiOrder): boolean {
  return ACTIVE_MENU_ORDER_STATUSES.has(order.status) || isAwaitingPayment(order);
}

function useClientActivityCounts(token: string | null, role: string | null) {
  const [counts, setCounts] = useState({ orders: 0, prescriptions: 0 });

  const load = useCallback(() => {
    if (!token || role !== "Client") {
      setCounts({ orders: 0, prescriptions: 0 });
      return;
    }

    let cancelled = false;
    Promise.allSettled([getClientOrderHistory(token), getMyPrescriptions(token)]).then((results) => {
      if (cancelled) return;
      const orders = results[0].status === "fulfilled" && Array.isArray(results[0].value) ? results[0].value : [];
      const prescriptions = results[1].status === "fulfilled" && Array.isArray(results[1].value) ? results[1].value : [];
      setCounts({
        orders: orders.filter((order: ApiOrder) => isMenuActiveOrder(order)).length,
        prescriptions: prescriptions.filter((prescription: ApiPrescription) => (
          ACTIVE_PRESCRIPTION_STATUSES.has(prescription.status)
        )).length,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [role, token]);

  useEffect(() => {
    const cleanup = load();
    return () => {
      cleanup?.();
    };
  }, [load]);

  const clientSignalRToken = role === "Client" ? token : null;
  useSignalREvent("OrderStatusChanged", load, clientSignalRToken);
  useSignalREvent("PrescriptionUpdated", load, clientSignalRToken);

  return counts;
}

function activityMeta(activity: LatestClientActivity) {
  if (activity.kind === "prescription") {
    const danger = activity.status === "Cancelled" || activity.status === "DecodeFailed";
    const progress = stageProgress(PRESCRIPTION_PROGRESS_STAGES, activity.status);
    const label = activity.status === "Decoded"
      ? "Готов"
      : PRESCRIPTION_STATUS_LABEL_RU[activity.status] ?? activity.status;
    return {
      href: `/prescriptions/${activity.id}`,
      label,
      progress,
      color: danger ? "#D4484C" : ACTIVITY_PROGRESS_COLOR,
      icon: "orders" as const,
    };
  }

  const danger = activity.status === "Cancelled" || activity.status === "Returned";
  const progress = stageProgress(ORDER_PROGRESS_STAGES, activity.status, {
    PickedUp: "Delivered",
  });
  return {
    href: "/orders",
    label: ORDER_STATUS_LABEL_RU[activity.status] ?? activity.status,
    progress,
    color: danger ? "#D4484C" : ACTIVITY_PROGRESS_COLOR,
    icon: "bag" as const,
  };
}

function LatestClientActivityButton() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const [activity, setActivity] = useState<LatestClientActivity | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    setLoaded(false);
    if (!token || role !== "Client") {
      setActivity(null);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    Promise.allSettled([getClientOrderHistory(token), getMyPrescriptions(token)]).then((results) => {
      if (cancelled) return;
      const orders = results[0].status === "fulfilled" && Array.isArray(results[0].value) ? results[0].value : [];
      const prescriptions = results[1].status === "fulfilled" && Array.isArray(results[1].value) ? results[1].value : [];
      const orderActivities: LatestClientActivity[] = orders
        .filter((o: ApiOrder) => Boolean(o.orderId && (o.createdAtUtc || o.orderPlacedAt) && ACTIVE_ORDER_STATUSES.has(o.status)))
        .map((o: ApiOrder) => ({
          kind: "order",
          id: o.orderId,
          status: o.status,
          createdAtUtc: o.createdAtUtc || o.orderPlacedAt || "",
        }));
      const prescriptionActivities: LatestClientActivity[] = prescriptions
        .filter((p: ApiPrescription) => Boolean(p.prescriptionId && p.createdAtUtc && ACTIVE_PRESCRIPTION_STATUSES.has(p.status)))
        .map((p: ApiPrescription) => ({
          kind: "prescription",
          id: p.prescriptionId,
          status: p.status,
          createdAtUtc: p.createdAtUtc,
        }));
      const latest = [...orderActivities, ...prescriptionActivities].sort(
        (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
      )[0] ?? null;
      setActivity(latest);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [role, token]);

  useEffect(() => {
    const cleanup = load();
    return () => {
      cleanup?.();
    };
  }, [load]);

  const clientSignalRToken = role === "Client" ? token : null;
  useSignalREvent("OrderStatusChanged", load, clientSignalRToken);
  useSignalREvent("PrescriptionUpdated", load, clientSignalRToken);

  if (!token || role !== "Client") return null;

  if (!activity) {
    return (
      <span
        aria-hidden="true"
        className={`flex h-[46px] w-[74px] flex-shrink-0 items-center justify-center transition-opacity duration-150 sm:h-[50px] ${
          loaded ? "hidden" : "invisible"
        }`}
      />
    );
  }

  const meta = activityMeta(activity);
  const degrees = Math.max(0, Math.min(1, meta.progress)) * 360;

  return (
    <Link
      href={meta.href}
      title={`Последний статус: ${meta.label}`}
      aria-label={`Последний статус: ${meta.label}`}
      className="flex h-[46px] w-[74px] flex-shrink-0 flex-col items-center justify-center gap-0.5 transition active:scale-95 sm:h-[50px]"
    >
      <span
        className="relative flex h-9 w-9 items-center justify-center rounded-full p-[2px] sm:h-10 sm:w-10"
        style={{
          background: `conic-gradient(${meta.color} ${degrees}deg, ${ACTIVITY_PROGRESS_TRACK} 0deg)`,
        }}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-surface text-on-surface shadow-card">
          <Icon name={meta.icon} size={17} strokeWidth={2.4} />
        </span>
        <span
          className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface"
          style={{ backgroundColor: meta.color }}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
