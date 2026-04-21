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

// Yandex-Apteka-style horizontal shelf of product cards. Meant to be stacked
// several times on the home feed (Popular / Pain / Vitamins / Heart / ...),
// separated only by whitespace and a bold section heading.
export function MedicineRail({
  title,
  subtitle,
  medicines,
  isLoading,
  onViewAll,
  accent = "primary",
}: Props) {
  if (!isLoading && medicines.length === 0) return null;

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

      {/* Horizontal scroll strip — breaks out of AppShell's 90% width padding on
          each side so cards look edge-to-edge like in Yandex/Apteka.ru feeds. */}
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide scroll-touch -mx-[5vw] px-[5vw] pb-2 snap-x">
        {isLoading
          ? SKELETONS.map((i) => (
              <div
                key={i}
                className="w-[140px] xs:w-[150px] sm:w-[170px] flex-shrink-0 space-y-2 snap-start"
              >
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-3 w-4/5" rounded="md" />
                <Skeleton className="h-4 w-2/5" rounded="md" />
                <Skeleton className="h-8 w-full" rounded="full" />
              </div>
            ))
          : medicines.map((medicine) => (
              <div
                key={medicine.id}
                className="w-[140px] xs:w-[150px] sm:w-[170px] flex-shrink-0 snap-start"
              >
                <MedicineCard medicine={medicine} compact />
              </div>
            ))}
      </div>
    </section>
  );
}
