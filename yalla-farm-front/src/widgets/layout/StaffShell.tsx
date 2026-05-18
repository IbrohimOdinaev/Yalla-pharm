"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { Icon, type IconName } from "@/shared/ui";
import { ProductModal } from "@/widgets/product/ProductModal";

type StaffRole = "Admin" | "SuperAdmin" | "Pharmacist";

type StaffNavItem = {
  label: string;
  href: string;
  icon: IconName;
  group: string;
};

type StaffShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  userDisplayName?: string;
  sideSlot?: ReactNode;
  contentClassName?: string;
  includeProductModal?: boolean;
  showLogoutInSidebar?: boolean;
};

const ADMIN_ITEMS: StaffNavItem[] = [
  { label: "Dashboard", href: "/workspace#dashboard", icon: "grid", group: "Обзор" },
  { label: "Предложения", href: "/workspace#offers", icon: "bag", group: "Рабочее место" },
  { label: "Заказы", href: "/workspace#orders", icon: "orders", group: "Рабочее место" },
  { label: "Запросы", href: "/workspace/lookups", icon: "search", group: "Рабочее место" },
];

const SUPERADMIN_ITEMS: StaffNavItem[] = [
  { label: "Аптеки", href: "/superadmin#pharmacies", icon: "pharmacy", group: "Система" },
  { label: "Лекарства", href: "/superadmin#medicines", icon: "bag", group: "Система" },
  { label: "Заказы", href: "/superadmin#orders", icon: "orders", group: "Операции" },
  { label: "Рецепты", href: "/superadmin#prescriptions", icon: "orders", group: "Операции" },
];

const PHARMACIST_ITEMS: StaffNavItem[] = [
  { label: "Dashboard", href: "/pharmacist#dashboard", icon: "grid", group: "Обзор" },
  { label: "Очередь", href: "/pharmacist#queue", icon: "orders", group: "Рецепты" },
  { label: "Корзина", href: "/pharmacist/cart", icon: "bag", group: "Рецепты" },
  { label: "Каталог", href: "/pharmacist/catalog", icon: "pharmacy", group: "Каталог" },
  { label: "История", href: "/pharmacist/history", icon: "clock", group: "Каталог" },
];

const ROLE_LABELS: Record<StaffRole, string> = {
  Admin: "Admin",
  SuperAdmin: "SuperAdmin",
  Pharmacist: "Фармацевт",
};

const ROLE_HINTS: Record<StaffRole, string> = {
  Admin: "Кабинет аптеки",
  SuperAdmin: "Системная панель",
  Pharmacist: "Работа с рецептами",
};

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function splitHref(href: string): { path: string; hash: string } {
  const [path, hash = ""] = href.split("#");
  return { path: normalizePath(path || "/"), hash };
}

function itemsForRole(role: string | null): StaffNavItem[] {
  if (role === "SuperAdmin") return SUPERADMIN_ITEMS;
  if (role === "Pharmacist") return PHARMACIST_ITEMS;
  return ADMIN_ITEMS;
}

function defaultTitleForRole(role: string | null): string {
  if (role === "SuperAdmin") return "SuperAdmin";
  if (role === "Pharmacist") return "Pharmacist";
  return "Workspace";
}

function profileHrefForRole(role: string | null): string {
  if (role === "Admin") return "/workspace#profile";
  if (role === "SuperAdmin") return "/superadmin#pharmacies";
  if (role === "Pharmacist") return "/pharmacist";
  return "/";
}

export function StaffShell({
  children,
  title,
  subtitle,
  userDisplayName,
  sideSlot,
  contentClassName = "max-w-[1440px]",
  includeProductModal = true,
  showLogoutInSidebar = true,
}: StaffShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.auth.role) as StaffRole | null;
  const authName = useAppSelector((s) => s.auth.name);
  const [hash, setHash] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("staff-sidebar-collapsed");
    setCollapsed(saved === "1");
  }, []);

  useEffect(() => {
    const syncHash = () => {
      const next = window.location.hash.replace("#", "");
      setHash((prev) => (prev === next ? prev : next));
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    const interval = window.setInterval(syncHash, 120);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pathname]);

  const items = useMemo(() => itemsForRole(role), [role]);
  const groupedItems = useMemo(() => {
    const groups: { group: string; items: StaffNavItem[] }[] = [];
    for (const item of items) {
      const last = groups[groups.length - 1];
      if (!last || last.group !== item.group) groups.push({ group: item.group, items: [item] });
      else last.items.push(item);
    }
    return groups;
  }, [items]);

  const currentTitle = title ?? defaultTitleForRole(role);
  const roleLabel = role ? ROLE_LABELS[role] : "Пользователь";
  const roleHint = role ? ROLE_HINTS[role] : "Сессия";
  const userLabel = userDisplayName?.trim() || authName?.trim() || roleLabel;

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("staff-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  function onLogout() {
    dispatch(clearCredentials());
    router.replace(role === "Pharmacist" ? "/login/admin" : "/");
  }

  return (
    <div className="min-h-screen min-h-svh bg-surface text-on-surface lg:flex">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          aria-label="Закрыть меню"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-outline/60 bg-surface-container-lowest shadow-2xl transition-all duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:h-svh lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-[292px]"}`}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-container text-lg font-black text-white shadow-card">
            Y
          </span>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-base font-black">Yalla Pharm</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{roleHint}</p>
          </div>
          <button
            type="button"
            className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition hover:text-primary lg:flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Раскрыть меню" : "Свернуть меню"}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
          </button>
          <button
            type="button"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть меню"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {sideSlot ? (
          <div className={`px-3 pb-3 ${collapsed ? "lg:hidden" : ""}`}>{sideSlot}</div>
        ) : null}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {groupedItems.map((group) => (
            <div key={group.group} className="mb-5">
              <p className={`mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ${collapsed ? "lg:hidden" : ""}`}>
                  {group.group}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const currentPath = normalizePath(pathname);
                  const { path, hash: itemHash } = splitHref(item.href);
                  const pathMatches = currentPath === path || (!itemHash && path !== "/pharmacist" && currentPath.startsWith(`${path}/`));
                  const active = pathMatches && (itemHash ? hash === itemHash || (!hash && item === items[0]) : !hash);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      scroll={false}
                      title={collapsed ? item.label : undefined}
                      onClick={() => {
                        setMobileOpen(false);
                        setHash(itemHash);
                      }}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition active:scale-[0.99] ${
                        active
                          ? "bg-primary text-white shadow-card"
                          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                      } ${collapsed ? "lg:justify-center" : ""}`}
                    >
                      <Icon name={item.icon} size={20} />
                      <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-outline/50 p-3">
          <div className={`space-y-3 rounded-2xl bg-surface-container-low p-3 ${collapsed ? "lg:px-2" : ""}`}>
            <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-black text-primary">
                {roleLabel.slice(0, 2).toUpperCase()}
              </span>
              <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                  <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-primary">{roleLabel}</p>
                  <p className="truncate text-xs font-black">{userLabel}</p>
              </div>
            </div>
            <button
              type="button"
              disabled
              className={`flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2 text-[11px] font-bold text-on-surface-variant transition hover:text-primary ${collapsed ? "lg:hidden" : ""}`}
              title="Настройки пока не подключены"
            >
              <Icon name="settings" size={14} />
              Настройки
            </button>
          </div>
          <div className={`mt-2 ${collapsed ? "lg:hidden" : ""}`}>
                <Link
                  href={profileHrefForRole(role)}
                  scroll={false}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-surface-container-low px-3 py-3 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container hover:text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name="user" size={16} />
                  Профиль
                </Link>
          </div>
          {showLogoutInSidebar && role !== "Admin" ? (
            <button
              type="button"
              onClick={onLogout}
              className={`mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-secondary transition hover:bg-secondary/10 ${
                collapsed ? "lg:justify-center" : ""
              }`}
              title={collapsed ? "Выйти" : undefined}
            >
              <Icon name="logout" size={18} />
              <span className={collapsed ? "lg:hidden" : ""}>Выйти</span>
            </button>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-outline/60 bg-surface/95 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center gap-3 px-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню"
            >
              <Icon name="grid" size={20} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{currentTitle}</p>
              {subtitle ? <p className="truncate text-[11px] text-on-surface-variant">{subtitle}</p> : null}
            </div>
          </div>
        </header>
        <main className="flex-1 px-3 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          <div className={`mx-auto w-full ${contentClassName}`}>{children}</div>
        </main>
      </div>

      {includeProductModal ? <ProductModal /> : null}
    </div>
  );
}
