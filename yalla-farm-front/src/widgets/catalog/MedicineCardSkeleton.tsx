import { Skeleton } from "@/shared/ui";

type Props = {
  compact?: boolean;
};

// Mirror of MedicineCard's layout — image square, title lines, price/cta row.
// Used while a grid is loading so the page doesn't reflow when cards arrive.
export function MedicineCardSkeleton({ compact }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface-container-lowest">
      <Skeleton className="aspect-square w-full" rounded="2xl" />
      <div className={`flex flex-1 flex-col ${compact ? "gap-1.5 p-2.5" : "gap-2 p-3"}`}>
        <Skeleton className="h-3 w-4/5" rounded="md" />
        <Skeleton className="h-3 w-3/5" rounded="md" />
        <div className="mt-auto pt-1">
          <Skeleton className={compact ? "h-8 xs:h-9 w-full" : "h-9 xs:h-10 w-full"} rounded="full" />
        </div>
      </div>
    </div>
  );
}
