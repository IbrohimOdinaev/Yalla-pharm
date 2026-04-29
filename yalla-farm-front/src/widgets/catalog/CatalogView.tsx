"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCatalogMedicinesPaginated } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory } from "@/shared/types/api";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { MedicineCardSkeleton } from "@/widgets/catalog/MedicineCardSkeleton";
import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";

type Props = {
  /** Slug of the category to filter by; empty string / undefined → all products. */
  categorySlug?: string;
};

const PAGE_SIZE = 24;

// Catalog body — sidebar tree + infinite-scroll grid. Used by /catalog and
// /catalog/[slug] routes. Navigates between categories via router.push so
// every category view has its own SEO-friendly URL.
export function CatalogView({ categorySlug }: Props) {
  const router = useRouter();
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>("");
  const [showMobileCategories, setShowMobileCategories] = useState(false);

  // `requestId` increments on every filter change so stale in-flight responses
  // don't pollute the new list when the user toggles category/pharmacy quickly.
  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  // Resolve slug → category. If slug missing, render unfiltered.
  const flatCats = useMemo(
    () => [...categories, ...categories.flatMap((c) => c.children ?? [])],
    [categories]
  );
  const selected = useMemo(
    () => (categorySlug ? flatCats.find((c) => c.slug === categorySlug) : undefined),
    [flatCats, categorySlug]
  );
  const selectedCategoryId = selected?.id ?? "";
  const selectedCatName = selected?.name;

  // Auto-expand parent in sidebar when a child category is active.
  useEffect(() => {
    if (!selected) return;
    const parent = categories.find((c) => c.children?.some((ch) => ch.id === selected.id));
    if (parent) setExpandedCategoryId(parent.id);
    else if (selected.children?.length) setExpandedCategoryId(selected.id);
  }, [selected, categories]);

  // Single fetcher used both for initial load and "load more". Tags each
  // request with an id so late responses from a previous filter combo are
  // ignored once the user switches categories or pharmacy.
  const fetchPage = useCallback(
    (p: number, catId: string, pharmId: string | undefined, mode: "replace" | "append") => {
      const myId = ++requestIdRef.current;
      if (mode === "replace") setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);

      getCatalogMedicinesPaginated(p, PAGE_SIZE, catId || undefined, pharmId || undefined)
        .then((data) => {
          if (myId !== requestIdRef.current) return;
          const newItems = Array.isArray(data?.medicines) ? data.medicines : [];
          setMedicines((prev) => (mode === "append" ? [...prev, ...newItems] : newItems));
          const total = data?.totalCount ?? 0;
          const size = data?.pageSize ?? PAGE_SIZE;
          setTotalPages(Math.max(1, Math.ceil(total / size)));
          setPage(data?.page ?? p);
        })
        .catch((err) => {
          if (myId !== requestIdRef.current) return;
          setError(err instanceof Error ? err.message : "Не удалось загрузить каталог.");
        })
        .finally(() => {
          if (myId !== requestIdRef.current) return;
          setIsLoading(false);
          setIsLoadingMore(false);
        });
    },
    []
  );

  // First page on filter change.
  useEffect(() => {
    setMedicines([]);
    setPage(1);
    setTotalPages(1);
    fetchPage(1, selectedCategoryId, selectedPharmacy?.id, "replace");
  }, [fetchPage, selectedCategoryId, selectedPharmacy?.id]);

  // Real-time refetch — re-pull just the first page; later pages will be
  // re-paged on demand as the user scrolls. Avoids re-fetching the entire
  // long-scrolled list on every offer update.
  useOfferLiveUpdates(
    useCallback(() => {
      fetchPage(1, selectedCategoryId, selectedPharmacy?.id, "replace");
    }, [fetchPage, selectedCategoryId, selectedPharmacy?.id])
  );

  // Infinite scroll: when the sentinel slides into view (within 600px ahead),
  // pull the next page. Disabled when initial load is in flight, when we're
  // already loading the next page, or when we've reached the last page.
  const hasMore = page < totalPages;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (isLoading || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fetchPage(page + 1, selectedCategoryId, selectedPharmacy?.id, "append");
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, page, hasMore, isLoading, isLoadingMore, selectedCategoryId, selectedPharmacy?.id]);

  return (
    <div className="flex gap-6 min-h-[60vh]">
      {/* Sidebar — desktop */}
      <aside className="hidden sm:block w-[220px] lg:w-[260px] flex-shrink-0">
        <div className="sticky top-32">
          <h2 className="text-lg font-bold mb-3">Каталог</h2>
          <nav className="space-y-0.5 max-h-[70vh] overflow-y-auto pr-1">
            <Link
              href="/catalog"
              prefetch={false}
              className={`block w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition ${
                !selectedCategoryId ? "bg-primary text-white" : "hover:bg-surface-container-low text-on-surface"
              }`}
            >
              Все товары
            </Link>
            {categories.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-8 my-1 animate-pulse rounded-lg bg-surface-container-high" />
                ))
              : categories.map((cat) => {
                  const isActive = selectedCategoryId === cat.id;
                  const hasActiveChild = cat.children?.some((ch) => ch.id === selectedCategoryId);
                  const isExpanded = expandedCategoryId === cat.id;
                  return (
                    <div key={cat.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (cat.children?.length) {
                            // Parent → only toggle expansion. Same
                            // rationale as the mobile accordion below:
                            // parents rarely have products of their own,
                            // and tapping one shouldn't apply a filter.
                            setExpandedCategoryId(isExpanded ? "" : cat.id);
                            return;
                          }
                          router.push(`/catalog/${cat.slug}`);
                        }}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition flex items-center justify-between ${
                          isActive || hasActiveChild ? "bg-primary text-white" : "hover:bg-surface-container-low text-on-surface"
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {cat.children?.length ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            className={`flex-shrink-0 ml-1 transition ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        ) : null}
                      </button>
                      {isExpanded && cat.children?.length ? (
                        <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-surface-container-high pl-2">
                          {cat.children.map((sub) => (
                            <Link
                              key={sub.id}
                              href={`/catalog/${sub.slug}`}
                              prefetch={false}
                              className={`block w-full text-left rounded-lg px-3 py-1.5 text-sm transition ${
                                selectedCategoryId === sub.id
                                  ? "bg-primary/80 text-white font-semibold"
                                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                              }`}
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile category selector */}
        <div className="sm:hidden mb-4">
          <button
            type="button"
            onClick={() => setShowMobileCategories(!showMobileCategories)}
            className="flex w-full items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3 text-left transition hover:bg-surface-container"
            aria-expanded={showMobileCategories}
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Каталог
              </span>
              <span className="truncate text-sm font-bold text-on-surface">
                {selectedCatName || "Все товары"}
              </span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={`flex-shrink-0 text-on-surface-variant transition ${showMobileCategories ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showMobileCategories ? (
            <div className="mt-2 stitch-card p-2 max-h-[60vh] overflow-y-auto space-y-0.5">
              <Link
                href="/catalog"
                prefetch={false}
                onClick={() => setShowMobileCategories(false)}
                className={`block w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  !selectedCategoryId ? "bg-primary text-white" : "hover:bg-surface-container-low"
                }`}
              >
                Все товары
              </Link>
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
                          // Parent with children → only toggle the
                          // expansion arrow. We don't navigate to the
                          // parent's listing (those rarely contain
                          // products of their own here) and we don't
                          // close the panel — the user is mid-drill-down,
                          // a close would force a re-open to pick a sub.
                          setExpandedCategoryId(isExpanded ? "" : cat.id);
                          return;
                        }
                        // Leaf category → apply filter and dismiss the
                        // accordion so the grid is fully visible.
                        router.push(`/catalog/${cat.slug}`);
                        setShowMobileCategories(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                        isActive || hasActiveChild ? "bg-primary text-white" : "hover:bg-surface-container-low"
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      {cat.children?.length ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          className={`flex-shrink-0 ml-2 transition ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      ) : null}
                    </button>
                    {isExpanded && cat.children?.length ? (
                      <div className="mt-0.5 ml-2 space-y-0.5 border-l-2 border-surface-container-high pl-2">
                        {cat.children.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/catalog/${sub.slug}`}
                            prefetch={false}
                            onClick={() => setShowMobileCategories(false)}
                            className={`block w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                              selectedCategoryId === sub.id
                                ? "bg-primary/80 text-white font-semibold"
                                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                            }`}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low text-primary hover:bg-surface-container-high transition"
            aria-label="На главную"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold">{selectedCatName || "Все товары"}</h1>
        </div>

        {/* Subcategory chips */}
        {selected?.children?.length ? (
          <div className="flex gap-2 flex-wrap mb-4">
            {selected.children.map((sub) => (
              <Link
                key={sub.id}
                href={`/catalog/${sub.slug}`}
                prefetch={false}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selectedCategoryId === sub.id
                    ? "bg-primary text-white border-primary"
                    : "border-surface-container-high hover:bg-surface-container-low"
                }`}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <MedicineCardSkeleton key={i} />
            ))}
          </div>
        ) : null}
        {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

        {!isLoading && !error ? (
          medicines.length === 0 ? (
            <div className="stitch-card p-6 text-sm text-on-surface-variant">Ничего не найдено.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {medicines.map((medicine) => (
                  <MedicineCard key={medicine.id} medicine={medicine} />
                ))}
                {/* Filler skeletons while next page is in flight, so the
                    grid grows visibly without reflowing once data lands. */}
                {isLoadingMore
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <MedicineCardSkeleton key={`more-${i}`} />
                    ))
                  : null}
              </div>

              {/* Sentinel — IntersectionObserver triggers fetch of next page
                  ~600px before it scrolls into view. */}
              {hasMore ? (
                <div ref={sentinelRef} aria-hidden className="h-4" />
              ) : (
                <p className="pt-4 text-center text-xs text-on-surface-variant">
                  Это все товары
                </p>
              )}
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
