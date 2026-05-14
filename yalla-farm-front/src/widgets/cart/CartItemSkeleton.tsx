import { Skeleton } from "@/shared/ui";

// Mirrors the cart-page row layout (image, two-line title, +/- stepper,
// trailing X). Used during initial /cart load and inline when a specific
// item's medicine details are still hydrating, so we don't show "Загрузка…"
// placeholders that visibly mess with the row's price column alignment.
export function CartItemSkeleton() {
  return (
    <li className="flex items-center gap-2.5 rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:gap-3 xs:p-3.5 sm:gap-4 sm:p-4 md:gap-6 md:p-5 lg:gap-6">
      <div className="hidden h-8 w-8 flex-shrink-0 lg:block" />
      <Skeleton
        className="h-11 w-11 flex-shrink-0 xs:h-12 xs:w-12 sm:h-14 sm:w-14 md:h-16 md:w-16"
        rounded="xl"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-4/5" rounded="md" />
        <Skeleton className="h-3 w-3/5" rounded="md" />
        <Skeleton className="mt-1 h-3 w-16 lg:hidden" rounded="md" />
      </div>
      <div className="flex flex-shrink-0 items-center gap-2.5 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8">
        <Skeleton className="hidden h-5 w-20 lg:block" rounded="md" />
        <Skeleton className="h-8 w-24 md:h-9 md:w-28" rounded="full" />
      </div>
    </li>
  );
}
