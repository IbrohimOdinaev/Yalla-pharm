"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useRecordNavigation, useGoBack } from "@/shared/lib/useNavigationHistory";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";

type TopBarProps = {
  title: string;
  location?: string;
  backHref?: string;
  /** Show search bar + address button (home page layout) */
  homeMode?: boolean;
  onSearchClick?: () => void;
  addressText?: string;
  onAddressClick?: () => void;
  onLogoClick?: () => void;
};

export function TopBar({ title, backHref, homeMode, onSearchClick, addressText, onAddressClick, onLogoClick }: TopBarProps) {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const serverCartCount = useCartStore((s) => (s.basket.positions ?? []).length);
  const guestCartCount = useGuestCartStore((s) => s.items.length);
  const cartCount = token ? serverCartCount : guestCartCount;

  useRecordNavigation();
  const goBack = useGoBack();

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function onLogout() {
    dispatch(clearCredentials());
    setMenuOpen(false);
    router.push("/");
  }

  const roleLabels: Record<string, string> = { Client: "Клиент", Admin: "Администратор", SuperAdmin: "Суперадмин" };

  // ── HOME MODE: Logo | Search | Address | Account ──
  if (homeMode) {
    return (
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high">
        <div className="flex h-14 sm:h-16 items-center px-3 sm:px-5 lg:px-6">
          {/* Logo */}
          {onLogoClick ? (
            <button type="button" onClick={onLogoClick} className="flex items-center gap-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="Yalla" className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className="hidden sm:block text-sm lg:text-base font-bold text-on-surface whitespace-nowrap">Аптека Душанбе</span>
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="Yalla" className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className="hidden sm:block text-sm lg:text-base font-bold text-on-surface whitespace-nowrap">Аптека Душанбе</span>
            </Link>
          )}

          {/* Left spacer — small gap after logo */}
          <div className="w-4 sm:w-8 flex-shrink-0" />

          {/* Search bar — uses callback if provided, otherwise navigates to home search */}
          {onSearchClick ? (
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center gap-2.5 rounded-full border border-surface-container-high bg-surface-container-lowest px-4 sm:px-5 py-2 sm:py-2.5 text-left transition hover:bg-surface-container-low min-w-0 w-[45%] flex-shrink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant flex-shrink-0">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-sm text-on-surface-variant truncate">Найти в аптеках</span>
            </button>
          ) : (
            <Link
              href="/?search="
              className="flex items-center gap-2.5 rounded-full border border-surface-container-high bg-surface-container-lowest px-4 sm:px-5 py-2 sm:py-2.5 text-left transition hover:bg-surface-container-low min-w-0 w-[45%] flex-shrink no-underline"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant flex-shrink-0">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-sm text-on-surface-variant truncate">Найти в аптеках</span>
            </Link>
          )}

          {/* Small gap between search and address */}
          <div className="w-3 sm:w-5 flex-shrink-0" />

          {/* Address button */}
          <button
            type="button"
            onClick={onAddressClick}
            className="flex items-center gap-2 rounded-full border border-surface-container-high bg-surface-container-lowest px-3 sm:px-4 py-2 sm:py-2.5 transition hover:bg-surface-container-low flex-shrink-0 max-w-[160px] sm:max-w-[240px]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-xs sm:text-sm font-medium text-on-surface truncate">
              {addressText || "Выберите адрес"}
            </span>
          </button>

          {/* Spacer — pushes cart+account to the right */}
          <div className="flex-1" />

          {/* Cart button — visible when cart has items */}
          {cartCount > 0 ? (
            <Link
              href="/cart"
              className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 sm:py-2.5 text-white transition hover:bg-primary/90 flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span className="text-xs sm:text-sm font-bold">{cartCount}</span>
            </Link>
          ) : null}

          {/* Account button */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface-container-low transition hover:bg-surface-container-high"
              aria-label="Аккаунт"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant sm:w-5 sm:h-5">
                <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
              {token ? (
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface" />
              ) : null}
            </button>

            {/* Dropdown menu */}
            {menuOpen ? (
              <div className="absolute right-0 top-12 w-56 max-w-[85vw] rounded-2xl bg-surface-container-lowest shadow-glass border border-surface-container-high p-2 space-y-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {token ? (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{roleLabels[role ?? ""] ?? "Пользователь"}</p>
                    </div>
                    {role !== "SuperAdmin" ? (
                      <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                        Мой профиль
                      </Link>
                    ) : null}
                    {role === "Client" ? (
                      <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        Мои заказы
                      </Link>
                    ) : null}
                    {role === "Admin" ? (
                      <Link href="/workspace" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
                        Кабинет
                      </Link>
                    ) : null}
                    {role === "SuperAdmin" ? (
                      <Link href="/superadmin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
                        Панель управления
                      </Link>
                    ) : null}
                    <div className="h-px bg-surface-container-high my-1" />
                    <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                      Выйти
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Гостевой режим</p>
                    </div>
                    <Link href="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                      Войти по SMS
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  // ── DEFAULT MODE: logo + title + logout ──
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high">
      <div className="flex h-12 sm:h-14 items-center justify-between px-3 sm:px-5 lg:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          {backHref ? (
            backHref === "back" ? (
              <button type="button" onClick={() => router.push(goBack())} className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            ) : (
              <Link href={backHref} className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
            )
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/logo-icon.png" alt="Yalla" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" />
          )}
          <h1 className="text-sm sm:text-base font-bold text-on-surface">{title}</h1>
        </div>
        {token ? (
          <button type="button" onClick={onLogout} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Выйти
          </button>
        ) : null}
      </div>
    </header>
  );
}
