"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { getAllMedicines } from "@/entities/medicine/admin-api";
import { getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import { getCategories, flattenCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory } from "@/shared/types/api";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore } from "@/features/pharmacist/model/prescriptionDraftStore";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { Button, Icon } from "@/shared/ui";

const PAGE_SIZE = 30;

export default function PharmacistCatalogPage() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const activeId = useActivePrescriptionStore((s) => s.activeId);
  const openPicker = useActivePrescriptionStore((s) => s.openPicker);
  const drafts = usePrescriptionDraftStore((s) => s.drafts);
  const addItem = usePrescriptionDraftStore((s) => s.addItem);

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ApiMedicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token || role !== "Pharmacist") return;
    let cancelled = false;
    setLoading(true); setError(null);
    const handle = setTimeout(async () => {
      try {
        const data = await getAllMedicines(token, query, page, PAGE_SIZE, undefined, categoryId || undefined);
        if (cancelled) return;
        setItems(data.medicines);
        setTotalCount(data.totalCount);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить каталог.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [token, role, query, page, categoryId]);

  const flatCats = flattenCategories(categories);

  const draftItemsByMedicine = (() => {
    if (!activeId) return new Set<string>();
    const cur = drafts[activeId];
    if (!cur) return new Set<string>();
    return new Set(cur.items.map((i) => i.medicineId).filter(Boolean) as string[]);
  })();

  function add(med: ApiMedicine) {
    if (!activeId) {
      openPicker();
      return;
    }
    addItem(activeId, {
      draftId: `cat-${med.id}-${Date.now()}`,
      medicineId: med.id,
      manualMedicineName: null,
      quantity: 1,
      pharmacistComment: null,
      displayTitle: getMedicineDisplayName(med),
      minPrice: med.minPrice ?? null,
    });
    setRecentlyAddedId(med.id);
    setTimeout(() => setRecentlyAddedId((v) => (v === med.id ? null : v)), 800);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <PharmacistShell>
      <div className="mx-auto max-w-5xl space-y-4">
        {!activeId ? (
          <div className="rounded-2xl bg-warning-soft p-4 text-sm text-on-surface">
            Активный рецепт не выбран — нажмите «Выбрать рецепт» в шапке, прежде чем добавлять лекарства.
          </div>
        ) : null}

        <div className="space-y-2">
          <input
            type="search"
            placeholder="Найти лекарство по названию или артикулу"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="stitch-input w-full"
          />
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="stitch-input w-full"
          >
            <option value="">Все категории</option>
            {flatCats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Ничего не найдено.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((m) => {
                const url = resolveMedicineImageUrl(m, 240);
                const offers = m.offers?.length ?? 0;
                const inDraft = draftItemsByMedicine.has(m.id);
                const justAdded = recentlyAddedId === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col rounded-2xl bg-surface-container-lowest p-3 shadow-card"
                  >
                    <div className="aspect-square overflow-hidden rounded-xl bg-surface-container">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-on-surface-variant/40">
                          <Icon name="pharmacy" size={28} />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-bold leading-tight">{getMedicineDisplayName(m)}</p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant">
                      Офферов: {offers}
                      {m.minPrice ? ` · от ${m.minPrice.toFixed(2)} TJS` : ""}
                    </p>
                    <Button
                      size="sm"
                      variant={inDraft && !justAdded ? "secondary" : "primary"}
                      className="mt-2"
                      onClick={() => add(m)}
                    >
                      {justAdded ? "Добавлено ✓" : inDraft ? "+ ещё одна" : "Добавить"}
                    </Button>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← Назад
                </Button>
                <span className="text-xs font-semibold text-on-surface-variant">{page} / {totalPages}</span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Вперёд →
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PharmacistShell>
  );
}
