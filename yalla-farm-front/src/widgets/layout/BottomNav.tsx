"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { Icon, type IconName } from "@/shared/ui";

const ADMIN_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/workspace#pharmacy", label: "Аптека", icon: "pharmacy" },
  { href: "/workspace#offers", label: "Предложения", icon: "bag" },
  { href: "/workspace#orders", label: "Заказы", icon: "orders" },
];

const SUPERADMIN_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/superadmin#pharmacies", label: "Аптеки", icon: "pharmacy" },
  { href: "/superadmin#medicines", label: "Лекарства", icon: "bag" },
  { href: "/superadmin#orders", label: "Заказы", icon: "orders" },
  { href: "/superadmin#prescriptions", label: "Рецепты", icon: "orders" },
];

const PHARMACIST_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/pharmacist", label: "Очередь", icon: "orders" },
];

export function BottomNav() {
  const pathname = usePathname();
  const role = useAppSelector((state) => state.auth.role);

  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const isAdminOrSA = role === "Admin" || role === "SuperAdmin";
  const isPharmacist = role === "Pharmacist";

  const items = useMemo(() => {
    if (role === "Admin") return ADMIN_ITEMS;
    if (role === "SuperAdmin") return SUPERADMIN_ITEMS;
    if (role === "Pharmacist") return PHARMACIST_ITEMS;
    return [];
  }, [role]);

  if (!isAdminOrSA && !isPharmacist) return null;

  const gridCols = items.length === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest safe-bottom border-t border-outline/70">
      <div className={`mx-auto grid h-14 max-w-5xl ${gridCols} gap-1 px-2 py-1`}>
        {items.map((item) => {
          const active = (() => {
            if (item.href.includes("#")) {
              const itemHash = "#" + item.href.split("#")[1];
              const itemPath = item.href.split("#")[0];
              if (pathname.startsWith(itemPath) && !hash) {
                const firstHashItem = items.find((i) => i.href.includes("#"));
                return firstHashItem === item;
              }
              return pathname.startsWith(itemPath) && hash === itemHash;
            }
            return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          })();

          const cls = `flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold truncate transition ${
            active
              ? "text-primary"
              : "text-on-surface-variant hover:bg-surface-container"
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
                <Icon name={item.icon} size={22} />
                {item.label}
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={cls}>
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
