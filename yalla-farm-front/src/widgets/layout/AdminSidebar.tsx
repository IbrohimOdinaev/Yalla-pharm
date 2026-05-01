"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/shared/ui";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useRouter } from "next/navigation";

type Item = { label: string; href: string; hash?: string; icon: IconName };

const ADMIN_ITEMS: Item[] = [
  { label: "Аптека", href: "/workspace", hash: "pharmacy", icon: "pharmacy" },
  { label: "Предложения", href: "/workspace", hash: "offers", icon: "bag" },
  { label: "Заказы", href: "/workspace", hash: "orders", icon: "orders" },
];

const SUPERADMIN_ITEMS: Item[] = [
  { label: "Аптеки", href: "/superadmin", hash: "pharmacies", icon: "pharmacy" },
  { label: "Лекарства", href: "/superadmin", hash: "medicines", icon: "bag" },
  { label: "Заказы", href: "/superadmin", hash: "orders", icon: "orders" },
  { label: "Платежи", href: "/superadmin", hash: "payments", icon: "card" },
  { label: "Возвраты", href: "/superadmin", hash: "refunds", icon: "warning" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const role = useAppSelector((s) => s.auth.role);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [hash, setHash] = useState("");

  useEffect(() => {
    setHash(window.location.hash.replace("#", ""));
    const onHash = () => setHash(window.location.hash.replace("#", ""));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const items = role === "SuperAdmin" ? SUPERADMIN_ITEMS : ADMIN_ITEMS;

  function onLogout() {
    dispatch(clearCredentials());
    // Replace so the admin URL leaves the history stack — Back can't return
    // the user to the now-unauthorized workspace.
    router.replace("/");
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col bg-surface-container-lowest shadow-glass lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white font-display font-extrabold">
          Y
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold text-on-surface">Yalla Farm</p>
          <p className="truncate text-[11px] font-semibold text-primary">
            {role === "SuperAdmin" ? "Панель супер-админа" : "Кабинет администратора"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((it) => {
          const active = pathname.startsWith(it.href) && (it.hash ? hash === it.hash : true) && (it.hash || hash === "");
          return (
            <Link
              key={it.label}
              href={it.hash ? `${it.href}#${it.hash}` : it.href}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-primary text-white shadow-card"
                  : "text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <Icon name={it.icon} size={18} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-container-high p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
        >
          <Icon name="logout" size={18} />
          Выйти
        </button>
      </div>
    </aside>
  );
}
