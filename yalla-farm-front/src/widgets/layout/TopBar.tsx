"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";

type TopBarProps = {
  title: string;
  location?: string;
  backHref?: string;
};

export function TopBar({ title, location = "Dushanbe, RT", backHref }: TopBarProps) {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high">
      <div className="mx-auto flex h-14 sm:h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link href={backHref} className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </Link>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">{location}</p>
            <h1 className="text-base sm:text-lg font-bold text-on-surface truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full bg-tertiary/10 px-2.5 py-1 text-[10px] font-bold text-tertiary">Душанбе</div>

          {/* Auth button */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low transition hover:bg-surface-container-high"
              aria-label="Аккаунт"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
                <circle cx="12" cy="8" r="4"/>
                <path d="M20 21a8 8 0 1 0-16 0"/>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                        Мой профиль
                      </Link>
                    ) : null}
                    {role === "Admin" ? (
                      <Link href="/workspace" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                        Кабинет
                      </Link>
                    ) : null}
                    {role === "SuperAdmin" ? (
                      <Link href="/superadmin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                        Панель управления
                      </Link>
                    ) : null}
                    <div className="h-px bg-surface-container-high my-1" />
                    <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Выйти
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Гостевой режим</p>
                    </div>
                    <Link href="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                      Войти
                    </Link>
                    <Link href="/register" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                      Регистрация
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
