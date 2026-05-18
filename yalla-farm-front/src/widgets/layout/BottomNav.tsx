"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { Icon, type IconName } from "@/shared/ui";

const ADMIN_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/workspace#dashboard", label: "Dashboard", icon: "grid" },
  { href: "/workspace#offers", label: "Предложения", icon: "bag" },
  { href: "/workspace#orders", label: "Заказы", icon: "orders" },
  { href: "/workspace/lookups", label: "Запросы", icon: "search" },
];

const SUPERADMIN_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/superadmin#pharmacies", label: "Аптеки", icon: "pharmacy" },
  { href: "/superadmin#medicines", label: "Лекарства", icon: "bag" },
  { href: "/superadmin#orders", label: "Заказы", icon: "orders" },
  { href: "/superadmin#prescriptions", label: "Рецепты", icon: "orders" },
];

const PHARMACIST_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/pharmacist#dashboard", label: "Dashboard", icon: "grid" },
  { href: "/pharmacist#queue", label: "Очередь", icon: "orders" },
  { href: "/pharmacist/cart", label: "Корзина", icon: "bag" },
  { href: "/pharmacist/catalog", label: "Каталог", icon: "pharmacy" },
  { href: "/pharmacist/history", label: "История", icon: "clock" },
];

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function BottomNav() {
  const pathname = usePathname();
  const role = useAppSelector((state) => state.auth.role);

  const [hash, setHash] = useState("");
  useEffect(() => {
    const syncHash = () => {
      const next = window.location.hash;
      setHash((prev) => (prev === next ? prev : next));
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    // Next.js updates URL via History API; hashchange is not guaranteed.
    const interval = window.setInterval(syncHash, 120);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pathname]);

  const isAdminOrSA = role === "Admin" || role === "SuperAdmin";
  const isPharmacist = role === "Pharmacist";

  const items = useMemo(() => {
    if (role === "Admin") return ADMIN_ITEMS;
    if (role === "SuperAdmin") return SUPERADMIN_ITEMS;
    if (role === "Pharmacist") return PHARMACIST_ITEMS;
    return [];
  }, [role]);

  if (!isAdminOrSA && !isPharmacist) return null;

  const gridCols = items.length === 3 ? "grid-cols-3" : items.length === 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest safe-bottom border-t border-outline/70">
      <div className={`mx-auto grid h-14 max-w-5xl ${gridCols} gap-1 px-2 py-1`}>
        {items.map((item) => {
          const active = (() => {
            const currentPath = normalizePath(pathname);
            if (item.href.includes("#")) {
              const itemHash = "#" + item.href.split("#")[1];
              const itemPath = normalizePath(item.href.split("#")[0] || "/");
              if (currentPath !== itemPath) return false;
              if (!hash) {
                const firstHashItem = items.find((i) => i.href.includes("#"));
                return firstHashItem === item;
              }
              return hash === itemHash;
            }
            if (item.href === "/") return pathname === "/";
            // Exact match only — multiple sibling routes (e.g. "/pharmacist"
            // vs "/pharmacist/cart") would otherwise both light up because
            // of the longest-prefix overlap.
            return currentPath === normalizePath(item.href);
          })();

          const cls = `flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold truncate transition ${
            active
              ? "text-primary"
              : "text-on-surface-variant hover:bg-surface-container"
          }`;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cls}
              scroll={false}
              onClick={() => {
                if (item.href.includes("#")) {
                  setHash("#" + (item.href.split("#")[1] || ""));
                } else {
                  setHash("");
                }
              }}
            >
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
