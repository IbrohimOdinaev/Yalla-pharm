"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCatalogMedicinesPaginated, searchMedicines } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { HeroCarousel } from "@/widgets/catalog/HeroCarousel";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { InfoBanner } from "@/shared/ui/InfoBanner";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";

function CatalogSidebar() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const cartCount = useCartStore((s) => (s.basket.positions ?? []).length);

  // Guest
  if (!token) {
    return (
      <aside className="hidden lg:block space-y-4">
        <div className="stitch-card p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Гостевой режим</p>
          <h3 className="font-bold">Каталог открыт без авторизации</h3>
          <p className="text-sm text-on-surface-variant">Добавляйте товары в корзину. Вход потребуется только перед оплатой.</p>
          <div className="flex gap-2">
            <Link href="/login" className="stitch-button text-sm">Войти</Link>
            <Link href="/register" className="stitch-button-secondary text-sm">Регистрация</Link>
          </div>
        </div>
        <div className="stitch-card p-4">
          <Link href="/cart" className="flex items-center justify-between text-sm font-semibold">
            <span>Корзина</span>
            <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant">войдите для доступа</span>
          </Link>
        </div>
      </aside>
    );
  }

  // Admin / SuperAdmin
  if (role === "Admin" || role === "SuperAdmin") {
    const roleLabel = role === "SuperAdmin" ? "SuperAdmin" : "Администратора";
    const workspaceLink = role === "SuperAdmin" ? "/superadmin" : "/workspace";
    return (
      <aside className="hidden lg:block space-y-4">
        <div className="stitch-card p-5 space-y-3">
          <h3 className="font-bold">Режим {roleLabel}</h3>
          <p className="text-sm text-on-surface-variant">Управление доступно в кабинете</p>
          <Link href={workspaceLink} className="stitch-button-secondary text-sm inline-block">Открыть кабинет</Link>
        </div>
      </aside>
    );
  }

  // Client
  return (
    <aside className="hidden lg:block space-y-4">
      <div className="stitch-card p-5 space-y-3">
        <h3 className="font-bold">Мой аккаунт</h3>
        <p className="text-sm text-on-surface-variant">Клиент</p>
        <Link href="/profile" className="stitch-button-secondary text-sm inline-block">Профиль</Link>
      </div>
      <div className="stitch-card p-4">
        <Link href="/cart" className="flex items-center justify-between text-sm font-semibold">
          <span>Корзина</span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">{cartCount}</span>
        </Link>
      </div>
    </aside>
  );
}

export default function HomePage() {
  const role = useAppSelector((s) => s.auth.role);
  const isAdminOrSA = role === "Admin" || role === "SuperAdmin";
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true); // only for initial load
  const [isSearching, setIsSearching] = useState(false); // for live search (no flicker)
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  const fetchMedicines = useCallback((searchQuery: string, p = 1) => {
    // Only show full loading state on initial load / pagination
    if (isInitialLoad.current) setIsLoading(true);
    else setIsSearching(true);
    setError(null);

    if (searchQuery.trim()) {
      searchMedicines(searchQuery.trim(), 24)
        .then((data) => {
          setMedicines(data);
          setPage(1);
          setTotalPages(1);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Не удалось загрузить каталог.");
        })
        .finally(() => { setIsLoading(false); setIsSearching(false); isInitialLoad.current = false; });
    } else {
      getCatalogMedicinesPaginated(p, 24)
        .then((data) => {
          setMedicines(Array.isArray(data?.medicines) ? data.medicines : []);
          const total = data?.totalCount ?? 0;
          const size = data?.pageSize ?? 24;
          setTotalPages(Math.max(1, Math.ceil(total / size)));
          setPage(data?.page ?? p);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Не удалось загрузить каталог.");
        })
        .finally(() => { setIsLoading(false); setIsSearching(false); isInitialLoad.current = false; });
    }
  }, []);

  useOfferLiveUpdates(useCallback(() => {
    fetchMedicines(query, page);
  }, [fetchMedicines, query, page]));

  useEffect(() => {
    fetchMedicines("", 1);
  }, [fetchMedicines]);

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMedicines(value, 1), 300);
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    fetchMedicines(query, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppShell top={<TopBar title="Аптека Душанбе" />}>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-5">
          {/* Search toggle */}
          {searchOpen ? (
            <div className="flex items-center gap-2 animate-in">
              <input
                className="stitch-input flex-1"
                type="search"
                placeholder="Название или артикул..."
                value={query}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
              />
              {isSearching ? (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setQuery(""); fetchMedicines("", 1); }}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition"
                aria-label="Закрыть поиск"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-on-surface">Аптека Душанбе</h2>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container-high"
                aria-label="Поиск"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </div>
          )}

          {!query.trim() ? (
            <>
              <div className="stitch-card p-5">
                <h2 className="text-lg font-bold">Куда доставить?</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Предоставьте доступ к геолокации или выберите аптеку вручную на карте.</p>
                <div className="mt-4 flex gap-3">
                  <button className="stitch-button">Разрешить доступ</button>
                  <button className="stitch-button-secondary">Ввести адрес</button>
                </div>
              </div>

              <HeroCarousel />

              <InfoBanner text="Быстрая доставка по Душанбе: 30-45 минут" />
            </>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{query.trim() ? "Результаты поиска" : "Трендовые товары"}</h3>
            </div>

            {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товары...</div> : null}
            {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

            {!isLoading && !error ? (
              medicines.length === 0 ? (
                <div className="stitch-card p-6 text-sm text-on-surface-variant">Ничего не найдено.</div>
              ) : (
                <div className={`grid grid-cols-2 gap-2 sm:gap-4 transition-opacity duration-200 ${isSearching ? "opacity-50" : "opacity-100"}`}>
                  {medicines.map((medicine) => (
                    <MedicineCard key={medicine.id} medicine={medicine} hideCart={isAdminOrSA} />
                  ))}
                </div>
              )
            ) : null}

            {/* Pagination */}
            {!isLoading && !error && totalPages > 1 && !query.trim() ? (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  className="stitch-button-secondary px-4 py-2 text-sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Назад
                </button>
                <span className="text-sm font-semibold text-on-surface-variant">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="stitch-button-secondary px-4 py-2 text-sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Вперёд
                </button>
              </div>
            ) : null}
          </section>
        </section>

        <CatalogSidebar />
      </div>
    </AppShell>
  );
}
