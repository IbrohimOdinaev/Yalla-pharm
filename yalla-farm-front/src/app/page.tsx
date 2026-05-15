"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { replaceLastNavigation } from "@/shared/lib/useNavigationHistory";
import { getCatalogMedicinesPaginated, searchByPharmacy, liveSearch, type LiveSearchSuggestion } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory, ApiPharmacyMedicinesGroup } from "@/shared/types/api";
import { HeroCarousel } from "@/widgets/catalog/HeroCarousel";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { MedicineCardSkeleton } from "@/widgets/catalog/MedicineCardSkeleton";
import { MedicineRail } from "@/widgets/catalog/MedicineRail";
import Link from "next/link";
import { CategoryTile, type CategoryTilePalette } from "@/widgets/catalog/CategoryTile";
import { type CategoryIconKey } from "@/widgets/catalog/CategoryIcon";
import { AppShell } from "@/widgets/layout/AppShell";

import { useAppSelector } from "@/shared/lib/redux";

import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import { PharmacyBanners } from "@/widgets/pharmacy/PharmacyBanners";
import { PharmacyPickerModal } from "@/widgets/pharmacy/PharmacyPickerModal";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { PharmacyLogo } from "@/shared/ui";

const POPULAR_QUERIES = ["Парацетамол", "Ибупрофен", "Амоксициллин", "Цитрамон", "Лоратадин", "Омепразол"];

type QuickCategory = {
  icon: CategoryIconKey;
  palette: CategoryTilePalette;
  label: string;
  keywords?: string[];
  /** Optional photo (in `public/categories/`) shown instead of the SVG icon. */
  image?: string;
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
  { id: "pain", title: "Боль и жар", accent: "secondary", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { id: "vitamins", title: "Витамины и БАД", accent: "accent", keywords: ["витамин", "бад", "биодобав"] },
  { id: "cold", title: "Простуда и дыхание", accent: "tertiary", keywords: ["дыхат", "респират", "кашел", "бронх", "простуд", "грипп", "орви"] },
  { id: "allergy", title: "Аллергия", accent: "secondary", keywords: ["аллерг", "антигистамин"] },
  { id: "gi", title: "ЖКТ и пищеварение", accent: "primary", keywords: ["жкт", "желуд", "кишеч", "пищевар", "гастро", "печен"] },
  { id: "heart", title: "Сердце и давление", accent: "secondary", keywords: ["серд", "сосуд", "кардио", "давлен", "гиперт"] },
  { id: "baby", title: "Мама и малыш", accent: "primary", keywords: ["дет", "малыш", "младен", "мама", "беремен", "памперс", "подгузн"] },
];

const QUICK_CATEGORIES: QuickCategory[] = [
  // "Все категории" first — anchors the rail with the catch-all so users
  // who don't see their target among the quick tiles immediately know
  // where to look.
  { icon: "grid", palette: "mint", label: "Все категории", image: "/categories/all.png" },
  { icon: "thermometer", palette: "coral", label: "Боль и жар", image: "/categories/pain.png", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { icon: "allergy", palette: "rose", label: "Аллергия", image: "/categories/allergy.png", keywords: ["аллерг", "антигистамин"] },
  { icon: "lungs", palette: "sky", label: "Дыхание", image: "/categories/respiratory.png", keywords: ["дыхат", "респират", "кашел", "бронх", "лёгк", "легк", "горл"] },
  { icon: "vitamin", palette: "sun", label: "Витамины", image: "/categories/vitamins.png", keywords: ["витамин", "бад", "биодобав", "минерал"] },
  { icon: "heart", palette: "rose", label: "Сердце", image: "/categories/heart.png", keywords: ["сердц", "сердеч", "кардио", "сосуд", "давлен"] },
  { icon: "eye", palette: "sky", label: "Глаза", image: "/categories/eyes.png", keywords: ["глаз", "зрени", "офтальм", "капли"] },
  { icon: "moon", palette: "lilac", label: "Нервы и сон", image: "/categories/sleep.png", keywords: ["невр", "психи", "нерв", "сон", "снотв", "успок", "стресс", "антидепресс", "седат"] },
  { icon: "shield", palette: "sage", label: "Иммунитет", image: "/categories/immunity.png", keywords: ["иммун", "противовирус", "интерферон", "защит"] },
];

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeFallback() {
  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-[129px] w-[110px] animate-pulse rounded-2xl bg-surface-container-high sm:h-[152px] sm:w-[124px] lg:h-[175px] lg:w-[143px]" />
            </div>
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-surface-container-high" />
        <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <MedicineCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function HomeContent() {
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const isAdminOrSA = role === "Admin" || role === "SuperAdmin";
  const isStaff = role === "Admin" || role === "SuperAdmin" || role === "Pharmacist";
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
  // Modal flag for the "Все аптеки" picker. PharmacyBanners triggers
  // `openPicker()` on the store, this page is what actually renders the
  // modal — without it the click was a no-op.
  const isPickerOpen = usePharmacyStore((s) => s.isPickerOpen);
  const closePicker = usePharmacyStore((s) => s.closePicker);
  const searchParams = useSearchParams();
  const navRouter = useRouter();

  // Auto-redirect by role
  useEffect(() => {
    if (role === "Admin") navRouter.replace("/workspace");
    else if (role === "SuperAdmin") navRouter.replace("/superadmin");
    else if (role === "Pharmacist") navRouter.replace("/pharmacist");
  }, [role, navRouter]);

  // Restore view & query from URL params on mount
  const urlSearch = searchParams.get("search") ?? "";
  const urlPharmacy = searchParams.get("pharmacy") ?? "";

  // View mode: "home" | "search" — catalog moved to dedicated /catalog routes
  // for SEO-friendly URLs.
  const [view, setView] = useState<"home" | "search">(searchParams.has("search") ? "search" : "home");

  // Push current search filters into the address bar via replaceState so the
  // URL is shareable / back-buttonable for any combination of (query, pharmacy
  // filter). Used by every filter change site — typing, suggestion picks,
  // pharmacy chip toggles, popular queries, clears.
  function syncSearchUrl(q: string, pharmacyIdFilter: string) {
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("search", q.trim());
    else url.searchParams.set("search", "");
    if (pharmacyIdFilter) url.searchParams.set("pharmacy", pharmacyIdFilter);
    else url.searchParams.delete("pharmacy");
    window.history.replaceState({}, "", url.toString());
    replaceLastNavigation(url.pathname + url.search);
  }

  // Address modal — auto-open on first visit if no address saved
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const addressChecked = useRef(false);

  const [categories, setCategories] = useState<ApiCategory[]>([]);

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
  const [selectedSearchPharmacyId, setSelectedSearchPharmacyId] = useState<string>("");
  // When user enters search via a pharmacy banner, this pin overrides the global pharmacy
  // until search is closed. After exit, global selection is used again.
  const [pinnedSearchPharmacy, setPinnedSearchPharmacy] = useState<ActivePharmacy | null>(null);

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
  // Tracks rails that already have a fetch in-flight OR have completed
  // successfully, so re-renders inside the rail-fetch effect don't
  // double-dispatch. Lives in a ref (not state) because we only need
  // it to coordinate side-effects, not drive rendering. The previous
  // version used `railMeds[spec.id]` as the in-flight signal which had
  // a nasty failure mode: ONE transient .catch() would freeze the rail
  // as an empty array forever, since `[]` is truthy. We now leave the
  // entry undefined on error and let a single retry tick re-attempt.
  const railFetchedRef = useRef<Set<string>>(new Set());
  // Bumping this triggers the rail-fetch effect to re-run after a
  // failed attempt. Combined with the ref-based de-duplication, we get
  // "fetch once, retry once on failure, then stop" semantics — instead
  // of the old "fetch once, on failure die silently" path.
  const [railRetryTick, setRailRetryTick] = useState(0);
  // Resolves RailSpec.keywords → concrete category (id + slug) using the
  // loaded categories tree. `null` keyword list stays null (the "Popular" rail).
  type RailCatRef = { id: string | null; slug: string | null } | undefined;
  const railCategoryRefs = useMemo(() => {
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const out: Record<string, RailCatRef> = {};
    for (const spec of HOME_RAILS) {
      if (spec.keywords === null) {
        out[spec.id] = { id: null, slug: null };
        continue;
      }
      const match = allCats.find((c) => spec.keywords!.some((kw) => c.name.toLowerCase().includes(kw)));
      out[spec.id] = match ? { id: match.id, slug: match.slug } : undefined;
    }
    return out;
  }, [categories]);
  const railCategoryIds = useMemo(() => {
    const out: Record<string, string | null | undefined> = {};
    for (const [k, v] of Object.entries(railCategoryRefs)) {
      out[k] = v === undefined ? undefined : v.id;
    }
    return out;
  }, [railCategoryRefs]);

  // Reset the rail cache whenever the user switches pharmacy — stock differs.
  // Also wipes the in-flight ref so the new pharmacy's rails actually
  // refetch (without the clear they'd see the rail as already-fetched).
  useEffect(() => {
    setRailMeds({});
    railFetchedRef.current.clear();
  }, [selectedPharmacy?.id]);

  // Fire a parallel fetch for every rail that has a resolved categoryId (or
  // null for "any category"). Rails whose category wasn't found are silently
  // skipped — they simply won't render. The ref-based gate + a one-shot
  // retry on .catch() is the cure for the old "popular rail disappears on
  // refresh when a transient network/cold-start blip hits" bug.
  useEffect(() => {
    if (categories.length === 0) return;
    for (const spec of HOME_RAILS) {
      if (railFetchedRef.current.has(spec.id)) continue;
      const catId = railCategoryIds[spec.id];
      if (catId === undefined) continue;
      railFetchedRef.current.add(spec.id);
      getCatalogMedicinesPaginated(1, 10, catId || undefined, selectedPharmacy?.id)
        .then((data) => {
          setRailMeds((prev) => ({ ...prev, [spec.id]: Array.isArray(data?.medicines) ? data.medicines : [] }));
        })
        .catch(() => {
          // Transient blip — drop the rail from "fetched" so it picks
          // up again on the next effect run, and schedule that run for
          // 2s from now. Bumping railRetryTick is what actually
          // reschedules — the effect's dep array reads it. We don't
          // mark the cache as `[]` here: doing so would freeze the rail
          // empty forever (`[]` is truthy, our old guard let it pass).
          railFetchedRef.current.delete(spec.id);
          setTimeout(() => setRailRetryTick((t) => t + 1), 2000);
        });
    }
  }, [categories.length, railCategoryIds, selectedPharmacy?.id, railRetryTick]);

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

  // Search by pharmacy
  function doSearch(q: string, presetPharmacyId?: string) {
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
        const groups = data.pharmacies ?? [];
        // Resolution priority for pre-selecting the pharmacy chip:
        //   1. explicit preset (from URL on mount or pharmacy chip click)
        //   2. pinned pharmacy (entered search via banner)
        //   3. globally selected pharmacy (top-bar pharmacy picker)
        //   4. nothing — "Все аптеки" view
        if (presetPharmacyId && groups.some((p) => p.pharmacyId === presetPharmacyId)) {
          setSelectedSearchPharmacyId(presetPharmacyId);
        } else if (pinnedSearchPharmacy && groups.some((p) => p.pharmacyId === pinnedSearchPharmacy.id)) {
          setSelectedSearchPharmacyId(pinnedSearchPharmacy.id);
        } else if (!pinnedSearchPharmacy && selectedPharmacy && groups.some((p) => p.pharmacyId === selectedPharmacy.id)) {
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
      syncSearchUrl(value, selectedSearchPharmacyId);
    }, 350);
  }

  function openSearch(initialQuery = "") {
    setView("search");
    setQuery(initialQuery);
    if (initialQuery) {
      doSearch(initialQuery);
      syncSearchUrl(initialQuery, selectedSearchPharmacyId);
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
    // Push a new browser history entry so back works naturally; pre-encode the
    // pharmacy filter so a refresh keeps the chip selected.
    const url = new URL(window.location.href);
    url.searchParams.set("search", "");
    url.searchParams.set("pharmacy", pharmacy.id);
    navRouter.push(url.pathname + url.search);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }

  // Restore search results from URL on mount, including pharmacy filter so
  // shared / refreshed links land on the same filtered results the user sent.
  const searchRestored = useRef(false);
  useEffect(() => {
    if (searchRestored.current || !urlSearch) return;
    searchRestored.current = true;
    doSearch(urlSearch, urlPharmacy || undefined);
  }, [urlSearch, urlPharmacy]);

  // Match quick category label to actual category via keywords, then
  // navigate to its dedicated /catalog/[slug] page (SEO).
  function onQuickCategoryClick(label: string) {
    if (label === "Все категории") {
      navRouter.push("/catalog");
      return;
    }
    const quickCat = QUICK_CATEGORIES.find((c) => c.label === label);
    const keywords = quickCat?.keywords ?? [label.toLowerCase()];
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const match = allCats.find((c) => {
      const name = c.name.toLowerCase();
      return keywords.some((kw) => name.includes(kw));
    });
    if (match) navRouter.push(`/catalog/${match.slug}`);
    else navRouter.push("/catalog");
  }

  // Staff guard — renders nothing while the auth-redirect effect above hops
  // them to /workspace / /superadmin / /pharmacist. Without this the client
  // home page (catalog + categories + popular rails) flashes for one frame
  // before the navigator runs, which looks like a broken redirect.
  if (hydrated && isStaff) {
    return null;
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
                  onClick={() => { setQuery(""); setPharmacyResults([]); setSearchTotalCount(0); syncSearchUrl("", selectedSearchPharmacyId); searchInputRef.current?.focus(); }}
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
                      syncSearchUrl(s.title, selectedSearchPharmacyId);
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
                        onClick={() => { setSelectedSearchPharmacyId(""); setPinnedSearchPharmacy(null); syncSearchUrl(query, ""); }}
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
                    onClick={() => { setSelectedSearchPharmacyId(""); setPinnedSearchPharmacy(null); syncSearchUrl(query, ""); }}
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
                        const next = selectedSearchPharmacyId === group.pharmacyId ? "" : group.pharmacyId;
                        if (selectedSearchPharmacyId === group.pharmacyId) setPinnedSearchPharmacy(null);
                        setSelectedSearchPharmacyId(next);
                        syncSearchUrl(query, next);
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
                      onClick={() => { setQuery(q); doSearch(q); syncSearchUrl(q, selectedSearchPharmacyId); }}
                      className="rounded-full bg-surface-container-low px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm font-medium text-on-surface hover:bg-surface-container-high transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading — show skeletons of the same shape as results so the page
                doesn't reflow when data arrives. */}
            {searchLoading && (
              <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <MedicineCardSkeleton key={i} compact />
                ))}
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
                    /* The "Все категории" anchor uses the minimalist
                       arrow variant — no image, label top-left, round
                       arrow CTA bottom-right. Reads as "open the full
                       list" instead of competing with the photographic
                       category tiles next to it. */
                    image={cat.label === "Все категории" ? undefined : cat.image}
                    variant={cat.label === "Все категории" ? "arrow" : "default"}
                    onClick={() => onQuickCategoryClick(cat.label)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Prescription-decoding CTA — sits below the quick categories so
              the rail stays the first visual hit on the home page. Hidden for
              admin / superadmin since they don't shop. At xl+ the same CTA
              lives inline in the header next to the pharmacy pill — hide the
              banner there to avoid showing the entry point twice. */}
          {!isAdminOrSA ? (
            <Link
              href="/prescriptions/new"
              className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-3 transition active:scale-95 hover:bg-primary/15 sm:p-4 xl:hidden"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-card sm:h-12 sm:w-12">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface sm:text-base">Загрузите рецепт от врача</p>
                <p className="text-[11px] text-on-surface-variant sm:text-xs">
                  Фармацевт расшифрует и пришлёт готовый список лекарств · 3 TJS
                </p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-primary">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : null}

          <HeroCarousel />

          {/* Pharmacy banners */}
          <PharmacyBanners onPharmacyClick={openSearchForPharmacy} />
          <PharmacyPickerModal open={isPickerOpen} onClose={closePicker} />

          {/* Rails — fixed-count horizontal shelves, one per popular category.
              Each fetches independently so they flip from skeleton → content
              as their data arrives. Empty rails (no matching category or
              zero stock) are hidden automatically by MedicineRail.
              "Все →" navigates to the dedicated /catalog/[slug] route so
              search engines can index each category page. */}
          <div className="space-y-8 sm:space-y-12">
            {HOME_RAILS.map((spec) => {
              const ref = railCategoryRefs[spec.id];
              // Keyword-defined rail that found no matching category → drop it.
              if (spec.keywords !== null && (ref === undefined || !ref.id)) return null;
              const meds = railMeds[spec.id];
              const target = ref?.slug ? `/catalog/${ref.slug}` : "/catalog";
              return (
                <MedicineRail
                  key={spec.id}
                  title={spec.title}
                  accent={spec.accent}
                  medicines={meds ?? []}
                  isLoading={meds === undefined}
                  onViewAll={() => navRouter.push(target)}
                />
              );
            })}
          </div>

          {/* Footer CTA to the full catalog */}
          <div className="flex justify-center pt-4">
            <Link
              href="/catalog"
              className="rounded-full bg-surface-container px-6 py-3 text-sm font-bold text-on-surface transition active:scale-95 hover:bg-surface-container-high"
            >
              Открыть каталог →
            </Link>
          </div>
      </div>
    </AppShell>
  );
}
