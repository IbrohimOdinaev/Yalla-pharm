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
  /** Show the "Загрузите рецепт от врача" CTA in the desktop header next to
   *  the pharmacy pill. Hidden below xl (1280px) so the home page falls back
   *  to its own banner under the quick-categories rail at narrower widths. */
  showPrescriptionCta?: boolean;
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
  showLogout,
  hideSearch,
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
  //    inline address/pharmacy pills; below lg switches to a two-row layout
  //    (logo + full address + profile / full-width search). The pharmacy
  //    selector moves out of the header on mobile and lives as the last
  //    card in PharmacyBanners.
  if (homeMode) {
    const LogoBlock = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="Yalla" className="h-9 w-9 flex-shrink-0 sm:h-10 sm:w-10" />
        <span className="hidden font-display text-base font-extrabold text-on-surface lg:block whitespace-nowrap">
          Yalla Pharm
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
        {/* Address text capped 20% tighter than before so the search
            bar has more room to breathe. Long addresses still fit
            with ellipsis; the full string lives in the title hover. */}
        <span className="truncate max-w-[96px] sm:max-w-[128px] lg:max-w-[112px] xl:max-w-[160px] text-on-surface">
          {addressTitle || addressText || "Выберите адрес"}
        </span>
        <Icon name="chevron-down" size={12} className="flex-shrink-0 text-on-surface-variant" />
      </button>
    );

    const PrescriptionPill = showPrescriptionCta ? (
      <Link
        href="/prescriptions/new"
        title="Загрузите рецепт от врача · фармацевт расшифрует и пришлёт готовый список лекарств · 3 TJS"
        className="hidden lg:flex flex-shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-2 text-sm font-semibold text-on-surface transition hover:bg-primary/15"
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="14" x2="15" y2="14" />
            <line x1="12" y1="11" x2="12" y2="17" />
          </svg>
        </span>
        <span className="whitespace-nowrap">Загрузите рецепт</span>
      </Link>
    ) : null;

    // Mobile header column next to the logo — two stacked, INDEPENDENTLY
    // clickable rows so the brand label opens "/" while the address row opens
    // the address picker. Previously a single button wrapped both, which made
    // tapping "Yalla Pharm" trigger the address modal.
    const MobileBrandAndAddress = (
      <div className="-mx-1 flex min-w-0 flex-1 flex-col items-start px-1 py-0.5">
        {onLogoClick ? (
          <button
            type="button"
            onClick={onLogoClick}
            className="font-display text-base xs:text-lg font-extrabold leading-tight text-on-surface sm:text-xl rounded transition active:bg-surface-container-low/70"
          >
            Yalla Pharm
          </button>
        ) : (
          <Link
            href="/"
            className="font-display text-base xs:text-lg font-extrabold leading-tight text-on-surface sm:text-xl rounded transition active:bg-surface-container-low/70"
          >
            Yalla Pharm
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

    // Search bar — width capped at 893 px (+15% over 776 px, which itself was
    // +10% over the original 706 px). Cap keeps it from sprawling on ultra-
    // wide displays while still letting it dominate the row. Address sits to
    // the right; cart / prescription / profile cluster lives at the far right
    // (separated by an explicit flex-1 spacer below). The `ml-4 lg:ml-6`
    // gives a clearly-visible gap between the logo and the search bar.
    const DesktopSearch = !hideSearch ? (
      onSearchClick ? (
        <button
          type="button"
          onClick={onSearchClick}
          className="ml-4 lg:ml-6 flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition hover:bg-surface-container-highest lg:max-w-[1543px]"
        >
          {SearchInner}
        </button>
      ) : (
        <Link
          href="/?search="
          className="ml-4 lg:ml-6 flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition hover:bg-surface-container-highest lg:max-w-[1543px]"
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
          className="flex h-11 w-full items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition hover:bg-surface-container-highest"
        >
          {SearchInner}
        </button>
      ) : (
        <Link
          href="/?search="
          className="flex h-11 w-full items-center gap-3 rounded-full bg-surface-container-high px-5 text-left transition hover:bg-surface-container-highest"
        >
          {SearchInner}
        </Link>
      )
    ) : null;

    // Inline cart button — single morphing element so the empty↔filled
    // transition doesn't shift any sibling buttons.
    //
    // The container has a *fixed* width (180px desktop / 164px below),
    // matching the wider "filled" state. When the cart is empty we
    // collapse the visible pill inside via inline left+width clamp so
    // it reads as a compact round capsule, while the outer footprint
    // keeps the surrounding header layout still. Going empty → filled
    // animates the inner pill outward without nudging the search bar,
    // address, profile, etc.
    const cartFilled = cartCount > 0;
    const CartButton = (
      <Link
        href="/cart"
        aria-label={
          cartFilled
            ? (bestPrice
                ? `Корзина, от ${formatMoney(bestPrice.price)}`
                : `Корзина, ${cartCount} товаров`)
            : "Корзина"
        }
        // Outer slot: fixed size, always reserved. Hides below `sm` so
        // phones use the floating pill instead.
        className="relative hidden h-11 w-[164px] flex-shrink-0 sm:block sm:h-12 sm:w-[180px]"
      >
        {/* Morphing pill — absolutely positioned inside the slot.
            Empty state: collapses to a round 44×44 (sm: 48×48) circle
            docked to the right edge, so the bag icon sits in a true
            square and reads as a circle, not a stretched oval. Math:
            slot width − pill width = left offset. Mobile 164−44=120;
            sm 180−48=132. Filled state: expands to fill the whole
            slot. left + padding + text opacity all transition together
            for a smooth morph; nothing outside the slot moves. */}
        <span
          // `gap` must be 0 in the empty state — otherwise the (collapsed,
          // max-w-0 / opacity-0) price span still contributes its sibling
          // gap to the flex layout and pushes the icon a few pixels to the
          // left of true centre. Gap only kicks in once the pill is filled.
          className={`absolute inset-y-0 right-0 flex items-center justify-center rounded-full bg-[#3FC5C4] text-on-surface shadow-card transition-all duration-300 hover:bg-[#35B7B6]
            ${cartFilled ? "left-0 gap-2 px-5 sm:gap-2.5 sm:px-6" : "left-[120px] gap-0 px-0 sm:left-[132px]"}`}
        >
          <Icon name="bag" size={20} strokeWidth={cartFilled ? 2.4 : 2.2} className="flex-shrink-0" />
          {/* Price label — slides in / out on the right. opacity +
              max-width carry the animation; the actual text only
              renders when cartFilled is true so an empty cart never
              has a screen-reader-spoofable hidden "от 0 TJS". */}
          <span
            className={`overflow-hidden whitespace-nowrap font-display text-sm font-black tabular-nums transition-all duration-300 sm:text-[15px]
              ${cartFilled ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"}`}
          >
            {cartFilled ? (bestPrice ? `от ${formatMoney(bestPrice.price)}` : `${cartCount}`) : ""}
          </span>
        </span>
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
                    <Link
                      href="/prescriptions"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-surface-container"
                    >
                      <Icon name="orders" size={16} />
                      Мои рецепты
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
        {/* No max-width cap — the header spans the full viewport on ultra-wide
            displays per the user's request. Inner padding (px-6 / lg:px-10)
            still keeps content from kissing the screen edge. */}
        <div className="w-full">
          {/* DESKTOP (lg+): single row. Order requested:
              logo / search / address + prescription / … / cart / profile.
              Prescription pill is now part of the left/centre cluster
              (flush against the address pill); cart + profile sit at the
              right edge separated by a flex-1 spacer. */}
          <div className="hidden h-[66px] items-center gap-3 px-6 lg:flex lg:px-10">
            {LogoLink}
            {DesktopSearch}
            <div className="flex items-center gap-2 flex-shrink-0">
              {DesktopAddressPill}
              {PrescriptionPill}
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
          items and the user isn't already on /cart or /checkout.
          Sized ~60% larger than the original h-10 pill so the price stays
          readable at thumb-distance. */}
      {!onCartRoute && cartCount > 0 ? (
        <Link
          href="/cart"
          aria-label={
            bestPrice
              ? `Корзина, от ${formatMoney(bestPrice.price)}`
              : `Корзина, ${cartCount} товаров`
          }
          className="fixed bottom-6 right-4 z-40 flex h-16 w-[200px] items-center justify-center gap-2 rounded-full bg-[#3FC5C4] px-4 text-on-surface shadow-card transition hover:bg-[#35B7B6] active:scale-[0.98] safe-bottom sm:hidden"
        >
          <Icon name="bag" size={28} strokeWidth={2.4} className="flex-shrink-0" />
          {/* Fixed-width text container so different price strings (3 vs 6
              digits) don't shift the icon left/right and the pill itself
              never resizes. whitespace-nowrap keeps the price on a single
              line; tabular-nums gives every digit the same advance so the
              text-content footprint stays stable as the price changes. */}
          <span className="block w-[120px] whitespace-nowrap text-center font-display text-base font-black tabular-nums">
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
      <div className="flex h-14 w-full items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
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
