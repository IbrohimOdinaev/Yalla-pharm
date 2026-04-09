"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { replaceLastNavigation } from "@/shared/lib/useNavigationHistory";
import { getCatalogMedicinesPaginated, searchByPharmacy, liveSearch, type LiveSearchSuggestion } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory, ApiPharmacyMedicinesGroup } from "@/shared/types/api";
import { HeroCarousel } from "@/widgets/catalog/HeroCarousel";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { AppShell } from "@/widgets/layout/AppShell";

import { InfoBanner } from "@/shared/ui/InfoBanner";
import { useAppSelector } from "@/shared/lib/redux";

import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";

const POPULAR_QUERIES = ["Парацетамол", "Ибупрофен", "Амоксициллин", "Цитрамон", "Лоратадин", "Омепразол"];

const QUICK_CATEGORIES: { icon: string; label: string; keywords?: string[] }[] = [
  { icon: "🌡️", label: "Боль и жар", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { icon: "🤧", label: "Аллергия", keywords: ["аллерг", "антигистамин"] },
  { icon: "🫁", label: "Дыхание", keywords: ["дыхат", "респират", "кашел", "бронх", "лёгк", "легк", "горл"] },
  { icon: "💊", label: "Антибиотики", keywords: ["антибиотик", "противомикроб"] },
  { icon: "🧬", label: "Витамины", keywords: ["витамин", "бад", "биодобав", "минерал"] },
  { icon: "❤️", label: "Сердце", keywords: ["сердц", "сердеч", "кардио", "сосуд", "давлен"] },
  { icon: "🦠", label: "ЖКТ", keywords: ["жкт", "желуд", "кишеч", "пищевар", "гастро", "печен"] },
  { icon: "📋", label: "Все категории" },
];

export default function HomePage() {
  return (
    <Suspense fallback={<AppShell top={undefined}><div className="stitch-card p-6 text-sm">Загрузка...</div></AppShell>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const role = useAppSelector((s) => s.auth.role);
  const isAdminOrSA = role === "Admin" || role === "SuperAdmin";
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);
  const searchParams = useSearchParams();
  const navRouter = useRouter();

  // Auto-redirect by role
  useEffect(() => {
    if (role === "Admin") navRouter.replace("/workspace");
    else if (role === "SuperAdmin") navRouter.replace("/superadmin");
  }, [role, navRouter]);

  // Restore view & query from URL params on mount
  const urlSearch = searchParams.get("search") ?? "";

  // View mode: "home" | "search" | "catalog"
  const [view, setView] = useState<"home" | "search" | "catalog">(searchParams.has("search") ? "search" : "home");

  // Address modal — auto-open on first visit if no address saved
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const addressChecked = useRef(false);

  // Catalog (home view)
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>("");
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Search view
  const [query, setQuery] = useState(urlSearch);
  const [pharmacyResults, setPharmacyResults] = useState<ApiPharmacyMedicinesGroup[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [liveSuggestions, setLiveSuggestions] = useState<LiveSearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Per-pharmacy scroll pagination (pharmacyId → page index)
  const [pharmacyScrollPage, setPharmacyScrollPage] = useState<Record<string, number>>({});
  const CARDS_PER_SCROLL_PAGE = 20;

  // Pharmacy filter in search
  const [showPharmacyFilter, setShowPharmacyFilter] = useState(false);
  const [selectedSearchPharmacyId, setSelectedSearchPharmacyId] = useState<string>("");

  const isInitialLoad = useRef(true);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  const fetchMedicines = useCallback((p = 1, catId = "") => {
    if (isInitialLoad.current) setIsLoading(true);
    else setIsSearching(true);
    setError(null);

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
  }, []);

  useOfferLiveUpdates(useCallback(() => {
    fetchMedicines(page, selectedCategoryId);
  }, [fetchMedicines, page, selectedCategoryId]));

  useEffect(() => { loadDeliveryAddress(); }, [loadDeliveryAddress]);

  // Auto-open address modal on first visit if no address stored
  useEffect(() => {
    if (addressChecked.current) return;
    addressChecked.current = true;
    const saved = typeof window !== "undefined" ? localStorage.getItem("yalla.delivery.address") : null;
    if (!saved) {
      setIsFirstVisit(true);
      setShowAddressModal(true);
    }
  }, []);

  useEffect(() => {
    fetchMedicines(1, selectedCategoryId);
  }, [fetchMedicines, selectedCategoryId]);

  // Search by pharmacy
  function doSearch(q: string) {
    if (!q.trim()) {
      setPharmacyResults([]);
      setSearchTotalCount(0);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    searchByPharmacy(q.trim(), 20)
      .then((data) => {
        setPharmacyResults(data.pharmacies ?? []);
        setSearchTotalCount(data.totalCount ?? 0);
        setPharmacyScrollPage({});
        setSelectedSearchPharmacyId("");
      })
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : "Ошибка поиска");
      })
      .finally(() => setSearchLoading(false));
  }

  function onSearchInput(value: string) {
    setQuery(value);

    // Live search suggestions (fast, 150ms debounce)
    if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    if (value.trim().length >= 2) {
      setShowSuggestions(true);
      liveDebounceRef.current = setTimeout(() => {
        liveSearch(value.trim(), 8).then(setLiveSuggestions).catch(() => setLiveSuggestions([]));
      }, 150);
    } else {
      setLiveSuggestions([]);
      setShowSuggestions(false);
    }

    // Full search (350ms debounce)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(value);
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set("search", value.trim());
      else url.searchParams.delete("search");
      window.history.replaceState({}, "", url.toString());
      replaceLastNavigation(url.pathname + url.search);
    }, 350);
  }

  function openSearch(initialQuery = "") {
    setView("search");
    setQuery(initialQuery);
    if (initialQuery) {
      doSearch(initialQuery);
      const url = new URL(window.location.href);
      url.searchParams.set("search", initialQuery);
      window.history.replaceState({}, "", url.toString());
      replaceLastNavigation(url.pathname + url.search);
    }
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }

  // Sync view with URL search params (e.g. when navigating via GlobalTopBar search)
  useEffect(() => {
    if (searchParams.has("search") && view !== "search") {
      openSearch(searchParams.get("search") ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function closeSearch() {
    setView("home");
    setQuery("");
    setPharmacyResults([]);
    setSearchTotalCount(0);
    setSearchError(null);
    setSelectedSearchPharmacyId("");
    setShowPharmacyFilter(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("search");
    window.history.replaceState({}, "", url.toString());
    replaceLastNavigation("/");
  }

  // Restore search results from URL on mount
  const searchRestored = useRef(false);
  useEffect(() => {
    if (searchRestored.current || !urlSearch) return;
    searchRestored.current = true;
    doSearch(urlSearch);
  }, [urlSearch]);

  function onCategorySelect(catId: string) {
    const newId = catId === selectedCategoryId ? "" : catId;
    setSelectedCategoryId(newId);
    setPage(1);
    fetchMedicines(1, newId);
  }

  // Match quick category label to actual category via keywords
  function onQuickCategoryClick(label: string) {
    if (label === "Все категории") {
      setSelectedCategoryId("");
      setExpandedCategoryId("");
      setView("catalog");
      fetchMedicines(1, "");
      return;
    }
    const quickCat = QUICK_CATEGORIES.find((c) => c.label === label);
    const keywords = quickCat?.keywords ?? [label.toLowerCase()];
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const match = allCats.find((c) => {
      const name = c.name.toLowerCase();
      return keywords.some((kw) => name.includes(kw));
    });
    if (match) {
      setSelectedCategoryId(match.id);
      // If it's a child category, expand its parent
      const parent = categories.find((c) => c.children?.some((ch) => ch.id === match.id));
      if (parent) setExpandedCategoryId(parent.id);
      else if (match.children?.length) setExpandedCategoryId(match.id);
      setView("catalog");
      fetchMedicines(1, match.id);
    }
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    fetchMedicines(p, selectedCategoryId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── CATALOG VIEW ──
  if (view === "catalog") {
    const selectedCatName = [...categories, ...categories.flatMap((c) => c.children ?? [])].find((c) => c.id === selectedCategoryId)?.name;
    return (
      <AppShell>
        <div className="flex gap-6 min-h-[60vh]">
          {/* Sidebar — categories */}
          <aside className="hidden sm:block w-[220px] lg:w-[260px] flex-shrink-0">
            <div className="sticky top-32">
              <h2 className="text-lg font-bold mb-3">Каталог</h2>
              <nav className="space-y-0.5 max-h-[70vh] overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => { setSelectedCategoryId(""); setExpandedCategoryId(""); fetchMedicines(1, ""); }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition ${!selectedCategoryId ? "bg-primary text-white" : "hover:bg-surface-container-low text-on-surface"}`}
                >
                  Все товары
                </button>
                {categories.map((cat) => {
                  const isActive = selectedCategoryId === cat.id;
                  const hasActiveChild = cat.children?.some((ch) => ch.id === selectedCategoryId);
                  const isExpanded = expandedCategoryId === cat.id;
                  return (
                    <div key={cat.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (cat.children?.length) {
                            setExpandedCategoryId(isExpanded ? "" : cat.id);
                          }
                          setSelectedCategoryId(cat.id);
                          setPage(1);
                          fetchMedicines(1, cat.id);
                        }}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition flex items-center justify-between ${isActive || hasActiveChild ? "bg-primary text-white" : "hover:bg-surface-container-low text-on-surface"}`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {cat.children?.length ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`flex-shrink-0 ml-1 transition ${isExpanded ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                        ) : null}
                      </button>
                      {isExpanded && cat.children?.length ? (
                        <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-surface-container-high pl-2">
                          {cat.children.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => { setSelectedCategoryId(sub.id); setPage(1); fetchMedicines(1, sub.id); }}
                              className={`w-full text-left rounded-lg px-3 py-1.5 text-sm transition ${selectedCategoryId === sub.id ? "bg-primary/80 text-white font-semibold" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content — products */}
          <div className="flex-1 min-w-0">
            {/* Mobile category selector */}
            <div className="sm:hidden mb-4">
              <select
                value={selectedCategoryId}
                onChange={(e) => { setSelectedCategoryId(e.target.value); setPage(1); fetchMedicines(1, e.target.value); }}
                className="stitch-input w-full text-sm"
              >
                <option value="">Все товары</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>{cat.name}</option>
                    {(cat.children ?? []).map((sub) => (
                      <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Back button + category title */}
            <div className="flex items-center gap-3 mb-4">
              <button type="button" onClick={() => { setView("home"); setSelectedCategoryId(""); }} className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low text-primary hover:bg-surface-container-high transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-extrabold">{selectedCatName || "Все товары"}</h1>
            </div>

            {/* Subcategory chips */}
            {selectedCategoryId && (() => {
              const sel = categories.find((c) => c.id === selectedCategoryId);
              if (sel?.children?.length) {
                return (
                  <div className="flex gap-2 flex-wrap mb-4">
                    {sel.children.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => { setSelectedCategoryId(sub.id); setExpandedCategoryId(sel.id); setPage(1); fetchMedicines(1, sub.id); }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selectedCategoryId === sub.id ? "bg-primary text-white border-primary" : "border-surface-container-high hover:bg-surface-container-low"}`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                );
              }
              return null;
            })()}

            {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товары...</div> : null}
            {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

            {!isLoading && !error ? (
              medicines.length === 0 ? (
                <div className="stitch-card p-6 text-sm text-on-surface-variant">Ничего не найдено.</div>
              ) : (
                <div className={`grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 transition-opacity duration-200 ${isSearching ? "opacity-50" : "opacity-100"}`}>
                  {medicines.map((medicine) => (
                    <MedicineCard key={medicine.id} medicine={medicine} />
                  ))}
                </div>
              )
            ) : null}

            {/* Pagination */}
            {!isLoading && !error && totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button type="button" className="stitch-button-secondary px-4 py-2 text-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Назад</button>
                <span className="text-sm font-semibold text-on-surface-variant tabular-nums">{page} / {totalPages}</span>
                <button type="button" className="stitch-button-secondary px-4 py-2 text-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>Вперёд</button>
              </div>
            ) : null}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── SEARCH VIEW ──
  if (view === "search") {
    return (
      <AppShell>
        <div className="space-y-5 sm:space-y-7 lg:space-y-8 overflow-x-hidden">
          <section className="space-y-3 xs:space-y-4 min-w-0">
            {/* Search header */}
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
              <button
                type="button"
                onClick={closeSearch}
                className="flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition"
                aria-label="Назад"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="xs:w-[18px] xs:h-[18px]"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <input
                ref={searchInputRef}
                className="stitch-input flex-1 min-w-0 text-sm"
                type="search"
                placeholder="Название лекарства..."
                value={query}
                onChange={(e) => onSearchInput(e.target.value)}
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setPharmacyResults([]); setSearchTotalCount(0); searchInputRef.current?.focus(); }}
                  className="flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition"
                  aria-label="Очистить"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="xs:w-4 xs:h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Live search suggestions */}
            {showSuggestions && liveSuggestions.length > 0 && (
              <div className="stitch-card p-1 space-y-0.5 max-h-[50vh] overflow-y-auto">
                {liveSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-surface-container-low transition flex items-center justify-between gap-2"
                    onClick={() => {
                      setShowSuggestions(false);
                      setQuery(s.title);
                      doSearch(s.title);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      {s.categoryName ? <p className="text-[10px] text-on-surface-variant">{s.categoryName}</p> : null}
                    </div>
                    {s.minPrice ? <span className="text-xs font-bold text-primary flex-shrink-0">{s.minPrice.toFixed(0)} TJS</span> : null}
                  </button>
                ))}
              </div>
            )}

            {/* Pharmacy filter — always visible when results exist */}
            {pharmacyResults.length > 0 && (
              <div className="space-y-2">
                {/* Selected pharmacy banner */}
                {selectedSearchPharmacyId ? (() => {
                  const selected = pharmacyResults.find((p) => p.pharmacyId === selectedSearchPharmacyId);
                  return selected ? (
                    <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/pharmacies/icon/${selected.pharmacyId}/content`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" style={{ display: "none" }}>
                          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface">{selected.pharmacyTitle}</p>
                        <p className="text-xs text-on-surface-variant">Найдено {selected.totalInPharmacy} товаров</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSearchPharmacyId("")}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container-high transition"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : null;
                })() : null}

                {/* Pharmacy chips — always shown */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => setSelectedSearchPharmacyId("")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition ${
                      !selectedSearchPharmacyId
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    Все аптеки
                  </button>
                  {pharmacyResults.map((group) => (
                    <button
                      key={group.pharmacyId}
                      type="button"
                      onClick={() => setSelectedSearchPharmacyId(
                        selectedSearchPharmacyId === group.pharmacyId ? "" : group.pharmacyId
                      )}
                      className={`flex items-center gap-2 rounded-full px-1 pr-3 py-1 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition ${
                        selectedSearchPharmacyId === group.pharmacyId
                          ? "bg-primary text-white shadow-sm"
                          : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${
                        selectedSearchPharmacyId === group.pharmacyId ? "bg-white/20" : "bg-surface-container-high"
                      }`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/pharmacies/icon/${group.pharmacyId}/content`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      {group.pharmacyTitle}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        selectedSearchPharmacyId === group.pharmacyId ? "bg-white/20" : "bg-surface-container-high"
                      }`}>
                        {group.totalInPharmacy}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No query yet — show popular */}
            {!query.trim() && (
              <div className="space-y-3">
                <h3 className="text-xs xs:text-sm font-bold text-on-surface-variant">Популярные запросы</h3>
                <div className="flex flex-wrap gap-1.5 xs:gap-2">
                  {POPULAR_QUERIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setQuery(q); doSearch(q); }}
                      className="rounded-full bg-surface-container-low px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm font-medium text-on-surface hover:bg-surface-container-high transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {searchLoading && (
              <div className="flex items-center gap-2 py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-on-surface-variant">Ищем...</span>
              </div>
            )}

            {/* Error */}
            {searchError && (
              <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{searchError}</div>
            )}

            {/* Results */}
            {query.trim() && !searchLoading && !searchError && (() => {
              const filteredResults = selectedSearchPharmacyId
                ? pharmacyResults.filter((g) => g.pharmacyId === selectedSearchPharmacyId)
                : pharmacyResults;
              const showAsGrid = filteredResults.length === 1;

              return (
              <div className="space-y-5">
                {searchTotalCount > 0 && (
                  <p className="text-sm font-semibold text-on-surface-variant">
                    Найдено {selectedSearchPharmacyId
                      ? filteredResults[0]?.totalInPharmacy ?? 0
                      : searchTotalCount
                    } {(() => {
                      const n = selectedSearchPharmacyId ? (filteredResults[0]?.totalInPharmacy ?? 0) : searchTotalCount;
                      return n === 1 ? "результат" : n < 5 ? "результата" : "результатов";
                    })()}
                  </p>
                )}

                {pharmacyResults.length === 0 && (
                  <div className="stitch-card p-6 text-sm text-on-surface-variant text-center">
                    Ничего не найдено по запросу &laquo;{query}&raquo;
                  </div>
                )}

                {/* Single pharmacy or filtered → regular grid */}
                {showAsGrid && filteredResults.length === 1 && (
                  <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredResults[0].medicines.map((medicine) => (
                      <MedicineCard key={medicine.id} medicine={medicine} hideCart={isAdminOrSA} compact />
                    ))}
                  </div>
                )}

                {/* Multiple pharmacies → scrollable blocks per pharmacy */}
                {!showAsGrid && filteredResults.map((group) => {
                  const scrollPage = pharmacyScrollPage[group.pharmacyId] ?? 0;
                  const totalScrollPages = Math.ceil(group.medicines.length / CARDS_PER_SCROLL_PAGE);
                  const visibleMeds = group.medicines.slice(
                    scrollPage * CARDS_PER_SCROLL_PAGE,
                    (scrollPage + 1) * CARDS_PER_SCROLL_PAGE
                  );

                  return (
                    <div key={group.pharmacyId} className="space-y-2">
                      {/* Pharmacy header */}
                      <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
                        <div className="flex h-7 w-7 xs:h-8 xs:w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="xs:w-4 xs:h-4 sm:w-5 sm:h-5"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[11px] xs:text-xs sm:text-sm font-bold truncate">{group.pharmacyTitle}</h3>
                          <p className="text-[9px] xs:text-[10px] sm:text-xs text-on-surface-variant">{group.totalInPharmacy} {group.totalInPharmacy === 1 ? "товар" : group.totalInPharmacy < 5 ? "товара" : "товаров"}</p>
                        </div>
                        {/* Scroll page arrows */}
                        {totalScrollPages > 1 && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              disabled={scrollPage <= 0}
                              onClick={() => setPharmacyScrollPage((prev) => ({ ...prev, [group.pharmacyId]: scrollPage - 1 }))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition"
                              aria-label="Назад"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <span className="text-[10px] font-semibold text-on-surface-variant tabular-nums">{scrollPage + 1}/{totalScrollPages}</span>
                            <button
                              type="button"
                              disabled={scrollPage >= totalScrollPages - 1}
                              onClick={() => setPharmacyScrollPage((prev) => ({ ...prev, [group.pharmacyId]: scrollPage + 1 }))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition"
                              aria-label="Вперёд"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Horizontal scroll cards */}
                      <div className="flex gap-1 xs:gap-1.5 overflow-x-auto pb-2 snap-x scroll-touch -mx-1.5 px-1.5 xs:-mx-3 xs:px-3 sm:-mx-4 sm:px-4 sm:gap-2.5">
                        {visibleMeds.map((medicine) => (
                          <div key={medicine.id} className="w-[120px] xs:w-[130px] sm:w-[155px] max-w-[160px] flex-shrink-0 snap-start">
                            <MedicineCard medicine={medicine} hideCart={isAdminOrSA} compact />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </section>

        </div>
      </AppShell>
    );
  }

  // ── HOME VIEW ──
  return (
    <AppShell>
      <AddressPickerModal
        open={showAddressModal}
        onClose={() => { setShowAddressModal(false); setIsFirstVisit(false); }}
        autoGeolocate={isFirstVisit}
      />
      <div className="space-y-5 sm:space-y-7 lg:space-y-8 overflow-x-hidden">

          <HeroCarousel />

          <InfoBanner text="Быстрая доставка по Душанбе: 30-45 минут" />

          {/* Quick category filters */}
          <div className="flex gap-1.5 xs:gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-touch snap-x -mx-1.5 px-1.5 xs:-mx-3 xs:px-3 sm:-mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-3 lg:gap-4 sm:overflow-visible sm:pb-0">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => onQuickCategoryClick(cat.label)}
                className="stitch-card flex flex-col items-center gap-0.5 xs:gap-1 sm:gap-1.5 p-1.5 xs:p-2 sm:p-3 text-center transition hover:shadow-card hover:-translate-y-0.5 active:scale-95 min-w-[56px] xs:min-w-[68px] flex-shrink-0 snap-start sm:min-w-0"
              >
                <span className="text-base xs:text-lg sm:text-2xl">{cat.icon}</span>
                <span className="text-[8px] xs:text-[10px] sm:text-[11px] font-semibold leading-tight text-on-surface">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* All categories dropdown */}
          {showAllCategories && categories.length > 0 && (
            <div className="stitch-card p-3 space-y-1 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Все категории</h3>
                <button type="button" onClick={() => setShowAllCategories(false)} className="text-xs text-primary font-bold">Закрыть</button>
              </div>
              <button
                type="button"
                onClick={() => { onCategorySelect(""); setShowAllCategories(false); }}
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
                      if (!cat.children?.length) setShowAllCategories(false);
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
                          onClick={() => { onCategorySelect(sub.id); setShowAllCategories(false); }}
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

          {/* Selected category chip */}
          {selectedCategoryId && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onCategorySelect("")}
                className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary flex items-center gap-1"
              >
                {[...categories, ...categories.flatMap((c) => c.children ?? [])].find((c) => c.id === selectedCategoryId)?.name}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Medicine grid */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm xs:text-base sm:text-lg font-bold">{selectedCategoryId ? [...categories, ...categories.flatMap((c) => c.children ?? [])].find((c) => c.id === selectedCategoryId)?.name ?? "Товары" : "Трендовые товары"}</h3>
            </div>

            {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товары...</div> : null}
            {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

            {!isLoading && !error ? (
              medicines.length === 0 ? (
                <div className="stitch-card p-6 text-sm text-on-surface-variant">Ничего не найдено.</div>
              ) : (
                <div className={`grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 transition-opacity duration-200 ${isSearching ? "opacity-50" : "opacity-100"}`}>
                  {medicines.map((medicine) => (
                    <MedicineCard key={medicine.id} medicine={medicine} hideCart={isAdminOrSA} />
                  ))}
                </div>
              )
            ) : null}

            {/* Pagination */}
            {!isLoading && !error && totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2 xs:gap-3 pt-2">
                <button
                  type="button"
                  className="stitch-button-secondary px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Назад
                </button>
                <span className="text-xs xs:text-sm font-semibold text-on-surface-variant tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="stitch-button-secondary px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Вперёд
                </button>
              </div>
            ) : null}
          </section>
      </div>
    </AppShell>
  );
}
