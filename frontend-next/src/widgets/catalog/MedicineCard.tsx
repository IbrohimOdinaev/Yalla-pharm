"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";

type MedicineCardProps = {
  medicine: ApiMedicine;
};

export function MedicineCard({ medicine }: MedicineCardProps) {
  const token = useAppSelector((state) => state.auth.token);
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);

  const imageUrl = useMemo(() => resolveMedicineImageUrl(medicine), [medicine]);

  return (
    <article className="rounded-2xl border border-surface-container-high bg-surface-container-lowest p-3 shadow-card transition hover:-translate-y-0.5">
      <Link href={`/product/${medicine.id}`} className="block">
        <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-surface-container">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={getMedicineDisplayName(medicine)} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">Нет фото</div>
          )}
        </div>
        <h3 className="line-clamp-1 text-sm font-bold">{getMedicineDisplayName(medicine)}</h3>
        <p className="line-clamp-2 text-xs text-on-surface-variant">{medicine.description || "Описание временно недоступно"}</p>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-primary">{formatMoney(medicine.price)}</span>
        <button
          type="button"
          onClick={() => {
            if (!token) return;
            addItem(token, medicine.id).catch(() => undefined);
          }}
          disabled={!token || isLoading}
          className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          В корзину
        </button>
      </div>
    </article>
  );
}
