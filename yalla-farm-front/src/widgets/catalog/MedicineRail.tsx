import type { ApiMedicine } from "@/shared/types/api";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { Skeleton } from "@/shared/ui";

type Props = {
  /** Eye-catching section heading shown above the rail. */
  title: string;
  /** Optional tiny subtitle underneath, e.g. "21 товар". */
  subtitle?: string;
  medicines: ApiMedicine[];
  isLoading?: boolean;
  /** Callback for the "Все →" link (switches parent to catalog view filtered by this category). */
  onViewAll?: () => void;
  /** Colour of the vertical accent strip to the left of the heading — picks a category tone. */
  accent?: "primary" | "secondary" | "tertiary" | "accent";
};

const ACCENT_BAR: Record<NonNullable<Props["accent"]>, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  accent: "bg-accent",
};

const SKELETONS = Array.from({ length: 6 }, (_, i) => i);
/** Max cards shown per rail. Desktop lays out one row of 6 at lg+; on smaller
 * breakpoints the same 6 items wrap into 2–3 rows. "All →" takes users to the
 * full category view for more. */
const RAIL_MAX_CARDS = 6;

// Yandex-Apteka-style product rail. Uses a responsive grid that fits exactly
// 6 cards per row at lg+ and wraps to fewer columns on narrower screens.
// Previous horizontal-scroll variant caused the first card to appear clipped
// on initial render; the grid avoids that entirely.
export function MedicineRail({
  title,
  subtitle,
  medicines,
  isLoading,
  onViewAll,
  accent = "primary",
}: Props) {
  if (!isLoading && medicines.length === 0) return null;

  const visible = medicines.slice(0, RAIL_MAX_CARDS);

  return (
    <section className="space-y-3">
      {/* Heading row */}
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-6 w-1.5 rounded-full ${ACCENT_BAR[accent]} flex-shrink-0`} aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-on-surface truncate">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[11px] text-on-surface-variant">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="flex-shrink-0 text-xs font-bold text-primary transition hover:text-primary-container sm:text-sm"
          >
            Все →
          </button>
        ) : null}
      </div>

      {/* Responsive grid — 2 cols on phones, 3 on xs, 4 on md, 6 on lg+. */}
      <div className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {isLoading
          ? SKELETONS.map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-3 w-4/5" rounded="md" />
                <Skeleton className="h-4 w-2/5" rounded="md" />
                <Skeleton className="h-10 w-full" rounded="full" />
              </div>
            ))
          : visible.map((medicine) => (
              <MedicineCard key={medicine.id} medicine={medicine} />
            ))}
      </div>
    </section>
  );
}
