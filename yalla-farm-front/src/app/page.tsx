"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCatalogMedicinesPaginated, searchMedicines } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory } from "@/shared/types/api";
import { HeroCarousel } from "@/widgets/catalog/HeroCarousel";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { InfoBanner } from "@/shared/ui/InfoBanner";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { getMapProvider, getBrowserGeolocation, type GeoResult } from "@/shared/lib/map";
import dynamic from "next/dynamic";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

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
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const setDeliveryAddress = useDeliveryAddressStore((s) => s.setAddress);
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>("");
  const [showCategories, setShowCategories] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showDeliveryMap, setShowDeliveryMap] = useState(false);
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getActivePharmacies().then(setPharmacies).catch(() => undefined);
  }, []);

  const fetchMedicines = useCallback((searchQuery: string, p = 1, catId = "") => {
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
      getCatalogMedicinesPaginated(p, 24, catId || undefined)
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
    fetchMedicines(query, page, selectedCategoryId);
  }, [fetchMedicines, query, page, selectedCategoryId]));

  useEffect(() => { loadDeliveryAddress(); }, [loadDeliveryAddress]);

  useEffect(() => {
    fetchMedicines("", 1, selectedCategoryId);
  }, [fetchMedicines, selectedCategoryId]);

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMedicines(value, 1, selectedCategoryId), 300);
  }

  function onCategorySelect(catId: string) {
    const newId = catId === selectedCategoryId ? "" : catId;
    setSelectedCategoryId(newId);
    setPage(1);
    fetchMedicines(query, 1, newId);
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    fetchMedicines(query, p, selectedCategoryId);
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
                onClick={() => { setSearchOpen(false); setQuery(""); fetchMedicines("", 1, selectedCategoryId); }}
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
              <div className="stitch-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Куда доставить?</h2>
                  {deliveryAddress ? (
                    <button type="button" className="text-xs text-primary font-bold" onClick={() => setShowAddressInput(true)}>Изменить</button>
                  ) : null}
                </div>

                {deliveryAddress && !showAddressInput ? (
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary flex-shrink-0" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <p className="text-sm font-medium">{deliveryAddress}</p>
                  </div>
                ) : (
                  <>
                    {!showAddressInput ? (
                      <div className="space-y-2">
                        <div className="flex gap-3">
                          <button type="button" className={`stitch-button-secondary flex-1 text-sm ${geoLoading ? "opacity-50" : ""}`} disabled={geoLoading} onClick={async () => {
                            setGeoLoading(true);
                            setGeoError(null);
                            try {
                              const coords = await getBrowserGeolocation();
                              setUserCoords(coords);
                              const result = await getMapProvider().reverseGeocode(coords);
                              if (result) {
                                setDeliveryAddress(result.address);
                              }
                            } catch (err) {
                              setGeoError(err instanceof Error ? err.message : "Ошибка геолокации");
                            }
                            setGeoLoading(false);
                          }}>
                            <span className="flex items-center justify-center gap-2">
                              {geoLoading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
                              )}
                              Геолокация
                            </span>
                          </button>
                          <button type="button" className="stitch-button-secondary flex-1 text-sm" onClick={() => setShowDeliveryMap(!showDeliveryMap)}>
                            <span className="flex items-center justify-center gap-2">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              На карте
                            </span>
                          </button>
                          <button type="button" className="stitch-button flex-1 text-sm" onClick={() => setShowAddressInput(true)}>
                            Ввести адрес
                          </button>
                        </div>
                        {geoError ? <p className="text-xs text-red-600">{geoError}</p> : null}
                        {showDeliveryMap && (
                          <PharmacyMap
                            className="h-[250px]"
                            pharmacies={pharmacies
                              .filter((p) => p.latitude && p.longitude)
                              .map((p) => ({ id: p.id, title: p.title, address: p.address, lat: p.latitude!, lng: p.longitude! }))}
                            userLocation={userCoords}
                            pickMode
                            onMapClick={async (result: GeoResult) => {
                              setDeliveryAddress(result.address);
                              setUserCoords({ lat: result.lat, lng: result.lng });
                            }}
                          />
                        )}
                      </div>
                    ) : null}

                    {showAddressInput ? (
                      <div className="space-y-2">
                        <AddressAutocomplete
                          value={deliveryAddress}
                          onChange={setDeliveryAddress}
                          placeholder="Улица, дом, район..."
                        />
                        <div className="flex gap-2">
                          <button type="button" className="stitch-button text-xs flex-1" onClick={() => setShowAddressInput(false)}>
                            Готово
                          </button>
                          {deliveryAddress ? (
                            <button type="button" className="stitch-button-secondary text-xs" onClick={() => { setDeliveryAddress(""); }}>
                              Очистить
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
                {deliveryAddress ? <p className="text-xs text-on-surface-variant">Этот адрес будет использован по умолчанию при оформлении заказа</p> : null}
              </div>

              <HeroCarousel />

              {/* Categories */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCategories(!showCategories)}
                      className={`stitch-button-secondary text-sm flex items-center gap-2 ${showCategories ? "ring-2 ring-primary" : ""}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                      Категории
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className={`stitch-button-secondary text-sm flex items-center gap-2 ${showMap ? "ring-2 ring-primary" : ""}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      На карте
                    </button>
                    {selectedCategoryId && (
                      <button
                        type="button"
                        onClick={() => onCategorySelect("")}
                        className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary flex items-center gap-1"
                      >
                        {[...categories, ...categories.flatMap((c) => c.children ?? [])].find((c) => c.id === selectedCategoryId)?.name}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>

                  {showCategories && (
                    <div className="stitch-card p-3 space-y-1 max-h-[60vh] overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { onCategorySelect(""); setShowCategories(false); }}
                        className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                          !selectedCategoryId ? "bg-primary text-white" : "hover:bg-surface-container-low"
                        }`}
                      >
                        Все товары
                      </button>
                      {categories.map((cat) => (
                        <div key={cat.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (cat.children?.length) {
                                setExpandedCategoryId(expandedCategoryId === cat.id ? "" : cat.id);
                              }
                              onCategorySelect(cat.id);
                              if (!cat.children?.length) setShowCategories(false);
                            }}
                            className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold transition flex items-center justify-between ${
                              selectedCategoryId === cat.id ? "bg-primary text-white" : "hover:bg-surface-container-low"
                            }`}
                          >
                            {cat.name}
                            {cat.children?.length ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition ${expandedCategoryId === cat.id ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                            ) : null}
                          </button>
                          {expandedCategoryId === cat.id && cat.children?.length ? (
                            <div className="pl-3 space-y-0.5">
                              {cat.children.map((sub) => (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => { onCategorySelect(sub.id); setShowCategories(false); }}
                                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                                    selectedCategoryId === sub.id ? "bg-primary/80 text-white font-bold" : "text-on-surface-variant hover:bg-surface-container-low"
                                  }`}
                                >
                                  {sub.name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Map */}
              {showMap && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-on-surface-variant">Аптеки на карте</h3>
                  <PharmacyMap
                    className="h-[300px] sm:h-[400px]"
                    pharmacies={pharmacies
                      .filter((p) => p.latitude && p.longitude)
                      .map((p) => ({
                        id: p.id,
                        title: p.title,
                        address: p.address,
                        lat: p.latitude!,
                        lng: p.longitude!,
                      }))}
                  />
                  {pharmacies.filter((p) => p.latitude && p.longitude).length === 0 && (
                    <p className="text-xs text-on-surface-variant">Координаты аптек ещё не заданы.</p>
                  )}
                </div>
              )}

              <InfoBanner text="Быстрая доставка по Душанбе: 30-45 минут" />
            </>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{query.trim() ? "Результаты поиска" : selectedCategoryId ? [...categories, ...categories.flatMap((c) => c.children ?? [])].find((c) => c.id === selectedCategoryId)?.name ?? "Товары" : "Трендовые товары"}</h3>
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
