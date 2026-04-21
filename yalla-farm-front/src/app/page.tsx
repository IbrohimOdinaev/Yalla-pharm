"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { replaceLastNavigation } from "@/shared/lib/useNavigationHistory";
import { getCatalogMedicinesPaginated, searchByPharmacy, liveSearch, type LiveSearchSuggestion } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory, ApiPharmacyMedicinesGroup } from "@/shared/types/api";
import { HeroCarousel } from "@/widgets/catalog/HeroCarousel";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { MedicineRail } from "@/widgets/catalog/MedicineRail";
import { CategoryTile, type CategoryTilePalette } from "@/widgets/catalog/CategoryTile";
import { type CategoryIconKey } from "@/widgets/catalog/CategoryIcon";
import { AppShell } from "@/widgets/layout/AppShell";

import { TrustStrip } from "@/shared/ui";
import { useAppSelector } from "@/shared/lib/redux";

import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import { PharmacyBanners } from "@/widgets/pharmacy/PharmacyBanners";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { PharmacyLogo } from "@/shared/ui";

const POPULAR_QUERIES = ["Парацетамол", "Ибупрофен", "Амоксициллин", "Цитрамон", "Лоратадин", "Омепразол"];

type QuickCategory = {
  icon: CategoryIconKey;
  palette: CategoryTilePalette;
  label: string;
  keywords?: string[];
};

// Home-feed rails. Each rail resolves its server-side categoryId by matching
// one of the keywords against the category name — this keeps us working no
// matter how backend renames a category as long as the core word survives.
// `keywords: null` means "no category filter" → generic "Popular" rail.
type RailSpec = {
  id: string;
  title: string;
  accent: "primary" | "secondary" | "tertiary" | "accent";
  keywords: string[] | null;
};

const HOME_RAILS: RailSpec[] = [
  { id: "popular", title: "Популярные товары", accent: "accent", keywords: null },
  { id: "pain", title: "Боль и жар", accent: "secondary", keywords: ["боль", "жар", "обезболив", "анальг"] },
  { id: "vitamins", title: "Витамины и БАД", accent: "accent", keywords: ["витамин", "бад", "биодобав"] },
  { id: "cold", title: "Простуда и дыхание", accent: "tertiary", keywords: ["кашел", "бронх", "респират", "простуд"] },
  { id: "allergy", title: "Аллергия", accent: "secondary", keywords: ["аллерг", "антигистамин"] },
  { id: "gi", title: "ЖКТ и пищеварение", accent: "primary", keywords: ["жкт", "желуд", "пищевар", "гастро"] },
  { id: "heart", title: "Сердце и давление", accent: "secondary", keywords: ["сердц", "кардио", "давлен"] },
  { id: "baby", title: "Мама и малыш", accent: "primary", keywords: ["малыш", "беремен", "дет"] },
];

const QUICK_CATEGORIES: QuickCategory[] = [
  { icon: "thermometer", palette: "coral", label: "Боль и жар", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { icon: "allergy", palette: "rose", label: "Аллергия", keywords: ["аллерг", "антигистамин"] },
  { icon: "lungs", palette: "sky", label: "Дыхание", keywords: ["дыхат", "респират", "кашел", "бронх", "лёгк", "легк", "горл"] },
  { icon: "pill", palette: "lilac", label: "Антибиотики", keywords: ["антибиотик", "противомикроб"] },
  { icon: "vitamin", palette: "sun", label: "Витамины", keywords: ["витамин", "бад", "биодобав", "минерал"] },
  { icon: "heart", palette: "rose", label: "Сердце", keywords: ["сердц", "сердеч", "кардио", "сосуд", "давлен"] },
  { icon: "stomach", palette: "peach", label: "ЖКТ", keywords: ["жкт", "желуд", "кишеч", "пищевар", "гастро", "печен"] },
  { icon: "eye", palette: "sky", label: "Глаза", keywords: ["глаз", "зрени", "офтальм", "капли"] },
  { icon: "skin", palette: "peach", label: "Кожа и волосы", keywords: ["кож", "дермат", "волос", "шампун", "крем", "мазь"] },
  { icon: "drop", palette: "coral", label: "Диабет", keywords: ["диабет", "инсулин", "глюкоз", "сахар"] },
  { icon: "baby", palette: "sun", label: "Мама и малыш", keywords: ["дет", "малыш", "младен", "мама", "беремен", "памперс", "подгузн"] },
  { icon: "moon", palette: "lilac", label: "Нервы и сон", keywords: ["нерв", "сон", "успок", "стресс", "антидепресс", "седатив"] },
  { icon: "bone", palette: "mint", label: "Кости и суставы", keywords: ["кост", "сустав", "хондро", "остеопор", "артрит"] },
  { icon: "lipstick", palette: "rose", label: "Красота", keywords: ["космет", "парфюм", "ухо", "макияж", "помада"] },
  { icon: "shield", palette: "sage", label: "Иммунитет", keywords: ["иммун", "противовирус", "интерферон", "защит"] },
  { icon: "grid", palette: "mint", label: "Все категории" },
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
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
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
  // When user enters search via a pharmacy banner, this pin overrides the global pharmacy
  // until search is closed. After exit, global selection is used again.
  const [pinnedSearchPharmacy, setPinnedSearchPharmacy] = useState<ActivePharmacy | null>(null);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  // Cache of pharmacy-id → iconUrl so we can render logos without issuing
  // doomed-to-404 requests for pharmacies that have no icon uploaded yet.
  const [pharmacyIconsById, setPharmacyIconsById] = useState<Record<string, string | null | undefined>>({});
  useEffect(() => {
    getActivePharmacies()
      .then((list) => {
        const next: Record<string, string | null | undefined> = {};
        for (const p of list) next[p.id] = p.iconUrl;
        setPharmacyIconsById(next);
      })
      .catch(() => undefined);
  }, []);

  // Per-rail medicines, keyed by RailSpec.id. We populate these in parallel as
  // responses arrive so each rail can flip from skeleton → content
  // independently. Keyed map makes it trivial to skip already-fetched rails on
  // re-render and to blow the whole cache when the pharmacy filter changes.
  const [railMeds, setRailMeds] = useState<Record<string, ApiMedicine[]>>({});
  // Resolves RailSpec.keywords → concrete categoryId using the loaded
  // categories tree. `null` keyword list stays null (the "Popular" rail).
  const railCategoryIds = useMemo(() => {
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const out: Record<string, string | null | undefined> = {};
    for (const spec of HOME_RAILS) {
      if (spec.keywords === null) {
        out[spec.id] = null;
        continue;
      }
      const match = allCats.find((c) => spec.keywords!.some((kw) => c.name.toLowerCase().includes(kw)));
      out[spec.id] = match?.id;
    }
    return out;
  }, [categories]);

  // Reset the rail cache whenever the user switches pharmacy — stock differs.
  useEffect(() => {
    setRailMeds({});
  }, [selectedPharmacy?.id]);

  // Fire a parallel fetch for every rail that has a resolved categoryId (or
  // null for "any category"). Rails whose category wasn't found are silently
  // skipped — they simply won't render.
  useEffect(() => {
    if (categories.length === 0) return;
    for (const spec of HOME_RAILS) {
      if (railMeds[spec.id]) continue;
      const catId = railCategoryIds[spec.id];
      if (catId === undefined) continue;
      getCatalogMedicinesPaginated(1, 10, catId || undefined, selectedPharmacy?.id)
        .then((data) => {
          setRailMeds((prev) => ({ ...prev, [spec.id]: Array.isArray(data?.medicines) ? data.medicines : [] }));
        })
        .catch(() => {
          // Mark rail as "fetched empty" so we stop retrying on every render.
          setRailMeds((prev) => ({ ...prev, [spec.id]: [] }));
        });
    }
  }, [categories.length, railCategoryIds, selectedPharmacy?.id, railMeds]);

  const fetchMedicines = useCallback((p = 1, catId = "", pharmId?: string) => {
    if (isInitialLoad.current) setIsLoading(true);
    else setIsSearching(true);
    setError(null);

    getCatalogMedicinesPaginated(p, 24, catId || undefined, pharmId || undefined)
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
    fetchMedicines(page, selectedCategoryId, selectedPharmacy?.id);
  }, [fetchMedicines, page, selectedCategoryId, selectedPharmacy?.id]));

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
    fetchMedicines(1, selectedCategoryId, selectedPharmacy?.id);
  }, [fetchMedicines, selectedCategoryId, selectedPharmacy?.id]);

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
        // Pinned pharmacy (from banner click) wins over global selection
        if (pinnedSearchPharmacy && (data.pharmacies ?? []).some((p) => p.pharmacyId === pinnedSearchPharmacy.id)) {
          setSelectedSearchPharmacyId(pinnedSearchPharmacy.id);
        } else if (!pinnedSearchPharmacy && selectedPharmacy && (data.pharmacies ?? []).some((p) => p.pharmacyId === selectedPharmacy.id)) {
          setSelectedSearchPharmacyId(selectedPharmacy.id);
        } else {
          setSelectedSearchPharmacyId("");
        }
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

  // Sync view with URL search params in BOTH directions. Forward: GlobalTopBar
  // search click → router.push("/?search=") → enter search view. Reverse:
  // browser back removes the ?search= param → leave search view and reset its
  // local state (previously the component stayed stuck in search view with
  // stale chips/filters after browser back).
  useEffect(() => {
    const urlQ = searchParams.get("search");
    if (urlQ !== null) {
      if (view !== "search") openSearch(urlQ);
    } else if (view === "search") {
      setView("home");
      setQuery("");
      setPharmacyResults([]);
      setSearchTotalCount(0);
      setSearchError(null);
      setSelectedSearchPharmacyId("");
      setPinnedSearchPharmacy(null);
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
    setPinnedSearchPharmacy(null);
    // Use browser history — it knows the real previous URL even when typing
    // in the search box (replaceState doesn't add new entries)
    if (typeof window !== "undefined" && window.history.length > 1) {
      navRouter.back();
    } else {
      navRouter.replace("/");
    }
  }

  function openSearchForPharmacy(pharmacy: ActivePharmacy) {
    setPinnedSearchPharmacy(pharmacy);
    setSelectedSearchPharmacyId(pharmacy.id);
    setView("search");
    setQuery("");
    setPharmacyResults([]);
    setSearchTotalCount(0);
    // Push a new browser history entry so back works naturally
    const url = new URL(window.location.href);
    url.searchParams.set("search", "");
    navRouter.push(url.pathname + url.search);
    setTimeout(() => searchInputRef.current?.focus(), 100);
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
    fetchMedicines(1, newId, selectedPharmacy?.id);
  }

  // Match quick category label to actual category via keywords
  function onQuickCategoryClick(label: string) {
    if (label === "Все категории") {
      setSelectedCategoryId("");
      setExpandedCategoryId("");
      setView("catalog");
      fetchMedicines(1, "", selectedPharmacy?.id);
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
      const parent = categories.find((c) => c.children?.some((ch) => ch.id === match.id));
      if (parent) setExpandedCategoryId(parent.id);
      else if (match.children?.length) setExpandedCategoryId(match.id);
      setView("catalog");
      fetchMedicines(1, match.id, selectedPharmacy?.id);
    }
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    fetchMedicines(p, selectedCategoryId, selectedPharmacy?.id);
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
                  onClick={() => { setSelectedCategoryId(""); setExpandedCategoryId(""); fetchMedicines(1, "", selectedPharmacy?.id); }}
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
                          fetchMedicines(1, cat.id, selectedPharmacy?.id);
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
                              onClick={() => { setSelectedCategoryId(sub.id); setPage(1); fetchMedicines(1, sub.id, selectedPharmacy?.id); }}
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
                onChange={(e) => { setSelectedCategoryId(e.target.value); setPage(1); fetchMedicines(1, e.target.value, selectedPharmacy?.id); }}
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
                        onClick={() => { setSelectedCategoryId(sub.id); setExpandedCategoryId(sel.id); setPage(1); fetchMedicines(1, sub.id, selectedPharmacy?.id); }}
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
                      <PharmacyLogo
                        pharmacyId={selected.pharmacyId}
                        iconUrl={pharmacyIconsById[selected.pharmacyId]}
                        size={40}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface">{selected.pharmacyTitle}</p>
                        <p className="text-xs text-on-surface-variant">Найдено {selected.totalInPharmacy} товаров</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedSearchPharmacyId(""); setPinnedSearchPharmacy(null); }}
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
                    onClick={() => { setSelectedSearchPharmacyId(""); setPinnedSearchPharmacy(null); }}
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
                      onClick={() => {
                        if (selectedSearchPharmacyId === group.pharmacyId) setPinnedSearchPharmacy(null);
                        setSelectedSearchPharmacyId(
                          selectedSearchPharmacyId === group.pharmacyId ? "" : group.pharmacyId
                        );
                      }}
                      className={`flex items-center gap-2 rounded-full px-1 pr-3 py-1 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition ${
                        selectedSearchPharmacyId === group.pharmacyId
                          ? "bg-primary text-white shadow-sm"
                          : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      <PharmacyLogo
                        pharmacyId={group.pharmacyId}
                        iconUrl={pharmacyIconsById[group.pharmacyId]}
                        size={28}
                        className="flex-shrink-0"
                      />
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

            {/* Pinned pharmacy badge — shown when entered search via banner */}
            {pinnedSearchPharmacy && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary flex-shrink-0">
                  <path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
                </svg>
                <span className="text-xs font-semibold flex-1 truncate">Поиск в аптеке: {pinnedSearchPharmacy.title}</span>
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
      <div className="space-y-6 sm:space-y-8 overflow-x-hidden">

          {/* Quick categories — Yandex-style horizontal rail */}
          <section>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-1">
              {QUICK_CATEGORIES.map((cat) => (
                <div key={cat.label} className="flex-shrink-0">
                  <CategoryTile
                    icon={cat.icon}
                    palette={cat.palette}
                    label={cat.label}
                    onClick={() => onQuickCategoryClick(cat.label)}
                  />
                </div>
              ))}
            </div>
          </section>

          <HeroCarousel />

          <TrustStrip />

          {/* Pharmacy banners */}
          <PharmacyBanners onPharmacyClick={openSearchForPharmacy} />

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

          {/* Rails — fixed-count horizontal shelves, one per popular category.
              Each fetches independently so they flip from skeleton → content
              as their data arrives. Empty rails (no matching category or
              zero stock) are hidden automatically by MedicineRail. */}
          <div className="space-y-8 sm:space-y-12">
            {HOME_RAILS.map((spec) => {
              const catId = railCategoryIds[spec.id];
              // Keyword-defined rail that found no matching category → drop it.
              if (spec.keywords !== null && !catId) return null;
              const meds = railMeds[spec.id];
              return (
                <MedicineRail
                  key={spec.id}
                  title={spec.title}
                  accent={spec.accent}
                  medicines={meds ?? []}
                  isLoading={meds === undefined}
                  onViewAll={() => {
                    if (catId) {
                      setSelectedCategoryId(catId);
                      const parent = categories.find((c) => c.children?.some((ch) => ch.id === catId));
                      if (parent) setExpandedCategoryId(parent.id);
                    } else {
                      setSelectedCategoryId("");
                    }
                    setView("catalog");
                    fetchMedicines(1, catId || "", selectedPharmacy?.id);
                  }}
                />
              );
            })}
          </div>

          {/* Footer CTA to the full catalog */}
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId("");
                setExpandedCategoryId("");
                setView("catalog");
                fetchMedicines(1, "", selectedPharmacy?.id);
              }}
              className="rounded-full bg-surface-container px-6 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
            >
              Открыть каталог →
            </button>
          </div>
      </div>
    </AppShell>
  );
}
