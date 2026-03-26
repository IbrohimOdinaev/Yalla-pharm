"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";

const CLIENT_ITEMS = [
  { href: "/", label: "Каталог", icon: "catalog" },
  { href: "/cart", label: "Корзина", icon: "cart" },
  { href: "/orders", label: "Заказы", icon: "orders" },
  { href: "/profile", label: "Профиль", icon: "profile" },
];

const ADMIN_ITEMS = [
  { href: "/workspace#pharmacy", label: "Аптека", icon: "dashboard" },
  { href: "/workspace#offers", label: "Предложения", icon: "catalog" },
  { href: "/workspace#orders", label: "Заказы", icon: "orders" },
];

const SUPERADMIN_ITEMS = [
  { href: "/superadmin#pharmacies", label: "Аптеки", icon: "dashboard" },
  { href: "/superadmin#medicines", label: "Лекарства", icon: "catalog" },
  { href: "/superadmin#orders", label: "Заказы", icon: "orders" },
];

const GUEST_ITEMS = [
  { href: "/", label: "Каталог", icon: "catalog" },
  { href: "/cart", label: "Корзина", icon: "cart" },
  { href: "/orders", label: "Заказы", icon: "orders" },
  { href: "/profile", label: "Профиль", icon: "profile" },
];

function NavIcon({ type, className = "" }: { type: string; className?: string }) {
  const cn = `w-5 h-5 ${className}`;
  switch (type) {
    case "catalog":
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case "cart":
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
    case "orders":
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "profile":
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>;
    case "dashboard":
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/></svg>;
    case "login":
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
    default:
      return null;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);

  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const items = useMemo(() => {
    if (!token) return GUEST_ITEMS;
    if (role === "Admin") return ADMIN_ITEMS;
    if (role === "SuperAdmin") return SUPERADMIN_ITEMS;
    return CLIENT_ITEMS;
  }, [token, role]);

  const gridCols = items.length === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-container-high bg-surface/95 backdrop-blur-xl safe-bottom">
      <div className={`mx-auto grid h-16 max-w-5xl ${gridCols} gap-1 px-3 py-1.5`}>
        {items.map((item) => {
          const active = (() => {
            if (item.href.includes("#")) {
              const itemHash = "#" + item.href.split("#")[1];
              const itemPath = item.href.split("#")[0];
              // Default to first hash item when no hash is present
              if (pathname.startsWith(itemPath) && !hash) {
                const firstHashItem = items.find((i) => i.href.includes("#"));
                return firstHashItem === item;
              }
              return pathname.startsWith(itemPath) && hash === itemHash;
            }
            return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          })();
          const cls = `flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition ${
            active
              ? "bg-primary/10 text-primary"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`;

          if (item.href.includes("#")) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  window.location.hash = item.href.split("#")[1] || "";
                  setHash("#" + (item.href.split("#")[1] || ""));
                }}
                className={cls}
              >
                <NavIcon type={item.icon} className={active ? "text-primary" : ""} />
                {item.label}
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={cls}>
              <NavIcon type={item.icon} className={active ? "text-primary" : ""} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
