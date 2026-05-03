"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { getAllMedicines } from "@/entities/medicine/admin-api";
import { getCategories } from "@/entities/category/api";
import type { ApiCategory } from "@/shared/types/api";
import type { ApiMedicine } from "@/shared/types/api";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { CategoryTile, type CategoryTilePalette } from "@/widgets/catalog/CategoryTile";
import { type CategoryIconKey } from "@/widgets/catalog/CategoryIcon";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { Button } from "@/shared/ui";

// Same data the client home uses — keeps the pharmacist catalog visually
// identical to what clients see. Only the data source changes (we hit
// /api/medicines/all so out-of-stock items are visible).
type QuickCategory = {
  icon: CategoryIconKey;
  palette: CategoryTilePalette;
  label: string;
  keywords?: string[];
  image?: string;
};

const QUICK_CATEGORIES: QuickCategory[] = [
  { icon: "grid", palette: "mint", label: "Все категории" },
  { icon: "thermometer", palette: "coral", label: "Боль и жар", image: "/categories/pain.jpg", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { icon: "allergy", palette: "rose", label: "Аллергия", image: "/categories/allergy.jpg", keywords: ["аллерг", "антигистамин"] },
  { icon: "lungs", palette: "sky", label: "Дыхание", image: "/categories/respiratory.jpg", keywords: ["дыхат", "респират", "кашел", "бронх", "лёгк", "легк", "горл"] },
  { icon: "pill", palette: "lilac", label: "Антибиотики", image: "/categories/antibiotics.jpg", keywords: ["антибиотик", "противомикроб"] },
  { icon: "vitamin", palette: "sun", label: "Витамины", image: "/categories/vitamins.jpg", keywords: ["витамин", "бад", "биодобав", "минерал"] },
  { icon: "heart", palette: "rose", label: "Сердце", image: "/categories/heart.jpg", keywords: ["сердц", "сердеч", "кардио", "сосуд", "давлен"] },
  { icon: "stomach", palette: "peach", label: "ЖКТ", image: "/categories/gi.jpg", keywords: ["жкт", "желуд", "кишеч", "пищевар", "гастро", "печен"] },
  { icon: "eye", palette: "sky", label: "Глаза", image: "/categories/eyes.jpg", keywords: ["глаз", "зрени", "офтальм", "капли"] },
  { icon: "skin", palette: "peach", label: "Кожа и волосы", image: "/categories/skin.jpg", keywords: ["кож", "дермат", "волос", "шампун", "крем", "мазь"] },
  { icon: "drop", palette: "coral", label: "Диабет", image: "/categories/diabetes.jpg", keywords: ["диабет", "инсулин", "глюкоз", "сахар"] },
  { icon: "baby", palette: "sun", label: "Мама и малыш", image: "/categories/baby.jpg", keywords: ["дет", "малыш", "младен", "мама", "беремен", "памперс", "подгузн"] },
  { icon: "moon", palette: "lilac", label: "Нервы и сон", image: "/categories/sleep.jpg", keywords: ["невр", "психи", "нерв", "сон", "снотв", "успок", "стресс", "антидепресс", "седат"] },
  { icon: "bone", palette: "mint", label: "Кости и суставы", image: "/categories/bones.jpg", keywords: ["кост", "сустав", "хондро", "остеопор", "артрит"] },
  { icon: "lipstick", palette: "rose", label: "Красота", image: "/categories/beauty.jpg", keywords: ["космет", "парфюм", "ухо", "макияж", "помада"] },
  { icon: "shield", palette: "sage", label: "Иммунитет", image: "/categories/immunity.jpg", keywords: ["иммун", "противовирус", "интерферон", "защит"] },
];

const PAGE_SIZE = 24;

export default function PharmacistCatalogPage() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const activeId = useActivePrescriptionStore((s) => s.activeId);

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ApiMedicine[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  // Resolve a quick-category tile click → real categoryId by matching
  // its keywords against the loaded categories (mirrors the home logic).
  function onQuickCategoryClick(tile: QuickCategory) {
    if (tile.label === "Все категории") {
      setActiveCategoryId(null);
      setActiveCategoryLabel(null);
      setPage(1);
      return;
    }
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const keywords = tile.keywords ?? [tile.label.toLowerCase()];
    const match = allCats.find((c) => {
      const name = c.name.toLowerCase();
      return keywords.some((kw) => name.includes(kw));
    });
    setActiveCategoryId(match?.id ?? null);
    setActiveCategoryLabel(match ? tile.label : tile.label);
    setPage(1);
  }

  useEffect(() => {
    if (!token || role !== "Pharmacist") return;
    let cancelled = false;
    setLoading(true); setError(null);
    const handle = setTimeout(async () => {
      try {
        const data = await getAllMedicines(token, query, page, PAGE_SIZE, undefined, activeCategoryId || undefined);
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
  }, [token, role, query, page, activeCategoryId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount]
  );

  return (
    <PharmacistShell>
      <div className="space-y-6 sm:space-y-8 overflow-x-hidden">
        {!activeId ? (
          <div className="rounded-2xl bg-warning-soft p-3 text-xs text-on-surface">
            Активный рецепт не выбран — нажмите «Выбрать рецепт» в шапке, чтобы класть препараты в корзину.
          </div>
        ) : null}

        {/* Search — mirrors the client home's search pill but renders inline
            because the pharmacist header has its own pill (current rx). */}
        <input
          type="search"
          placeholder="Найти лекарство по названию или артикулу"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="stitch-input w-full"
        />

        {/* Quick categories — same horizontal rail as the client home. */}
        <section>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-1">
            {QUICK_CATEGORIES.map((cat) => (
              <div key={cat.label} className="flex-shrink-0">
                <CategoryTile
                  icon={cat.icon}
                  palette={cat.palette}
                  label={cat.label}
                  image={cat.image}
                  onClick={() => onQuickCategoryClick(cat)}
                />
              </div>
            ))}
          </div>
        </section>

        {activeCategoryLabel ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-on-surface-variant">
              Категория: <span className="font-bold text-on-surface">{activeCategoryLabel}</span>
            </p>
            <Button size="sm" variant="secondary" onClick={() => { setActiveCategoryId(null); setActiveCategoryLabel(null); setPage(1); }}>
              Сбросить
            </Button>
          </div>
        ) : null}

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
            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((m) => (
                <MedicineCard key={m.id} medicine={m} />
              ))}
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
