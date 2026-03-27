"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { getMedicineDisplayName, getMinimalImageUrl, getCheapestPrice } from "@/entities/medicine/api";

type MedicineCardProps = {
  medicine: ApiMedicine;
  hideCart?: boolean;
};

export function MedicineCard({ medicine, hideCart }: MedicineCardProps) {
  const token = useAppSelector((state) => state.auth.token);
  const addItem = useCartStore((state) => state.addItem);
  const serverPositions = useCartStore((state) => state.basket.positions);
  const addGuestItem = useGuestCartStore((state) => state.addItem);
  const guestItems = useGuestCartStore((state) => state.items);
  const setGuestQty = useGuestCartStore((state) => state.setQuantity);
  const removeGuestItem = useGuestCartStore((state) => state.removeItem);
  const setServerQty = useCartStore((state) => state.setQuantity);
  const removeServerItem = useCartStore((state) => state.removeItem);

  const thumbUrl = useMemo(() => getMinimalImageUrl(medicine), [medicine]);
  const price = getCheapestPrice(medicine);

  // Get quantity in cart (guest or authenticated)
  const cartState = useMemo(() => {
    if (token) {
      const pos = (serverPositions ?? []).find((p) => p.medicineId === medicine.id);
      return pos ? { inCart: true, quantity: pos.quantity, positionId: pos.id } : { inCart: false, quantity: 0, positionId: "" };
    }
    const item = guestItems.find((i) => i.medicineId === medicine.id);
    return item ? { inCart: true, quantity: item.quantity, positionId: "" } : { inCart: false, quantity: 0, positionId: "" };
  }, [token, serverPositions, guestItems, medicine.id]);

  function onAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (token) {
      addItem(token, medicine.id).catch(() => undefined);
    } else {
      addGuestItem(medicine.id);
    }
  }

  function onIncrement(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (token) {
      addItem(token, medicine.id).catch(() => undefined);
    } else {
      addGuestItem(medicine.id);
    }
  }

  function onDecrement(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const newQty = cartState.quantity - 1;
    if (newQty <= 0) {
      if (token) {
        removeServerItem(token, cartState.positionId).catch(() => undefined);
      } else {
        removeGuestItem(medicine.id);
      }
    } else {
      if (token) {
        setServerQty(token, cartState.positionId, newQty).catch(() => undefined);
      } else {
        setGuestQty(medicine.id, newQty);
      }
    }
  }

  const attrs = (medicine.atributes ?? []).slice(0, 2);

  return (
    <Link href={`/product/${medicine.id}`} className="block group">
      <article className="rounded-2xl bg-surface-container-lowest shadow-card overflow-hidden transition hover:shadow-glass hover:-translate-y-0.5">
        {/* Image with quantity badge */}
        <div className="relative aspect-square overflow-hidden bg-surface-container">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={getMedicineDisplayName(medicine)} className="h-full w-full object-cover transition group-hover:scale-105 duration-300" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-outline-variant opacity-40">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
              </svg>
            </div>
          )}
          {/* Quantity badge on image */}
          {cartState.inCart ? (
            <span className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-md">
              {cartState.quantity}
            </span>
          ) : null}
        </div>

        {/* Info */}
        <div className="p-3 space-y-1">
          <h3 className="text-sm font-bold leading-tight line-clamp-2 min-h-[2.5rem]">{getMedicineDisplayName(medicine)}</h3>

          {attrs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {attrs.map((attr) => (
                <span key={attr.name} className="text-[10px] text-on-surface-variant">
                  {attr.option}
                </span>
              ))}
            </div>
          ) : null}

          {medicine.articul ? (
            <p className="text-[9px] font-mono text-on-surface-variant/60">{medicine.articul}</p>
          ) : null}

          {/* Price / Cart controls */}
          {hideCart ? (
            /* Admin/SA mode: price only, no cart buttons */
            <div className="rounded-full bg-surface-container-low px-3 py-2 mt-1 text-center">
              <span className="text-sm font-bold text-on-surface">
                {price ? formatMoney(price) : "Нет офферов"}
              </span>
            </div>
          ) : cartState.inCart ? (
            /* In-cart mode: − price + */
            <div
              className="flex items-center justify-between rounded-full bg-primary/10 px-1 py-1 mt-1"
              onClick={(e) => e.preventDefault()}
            >
              <button
                type="button"
                onClick={onDecrement}
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-primary hover:bg-primary/20 transition"
                aria-label="Уменьшить"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <span className="text-sm font-bold text-primary">
                {price ? formatMoney(price) : "—"}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-primary hover:bg-primary/20 transition"
                aria-label="Увеличить"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          ) : (
            /* Not in cart: price + button */
            <button
              type="button"
              onClick={onAdd}
              className="flex w-full items-center justify-between rounded-full bg-surface-container-low px-1 py-1 mt-1 transition hover:bg-surface-container-high group/btn"
            >
              <span className="pl-3 text-sm font-bold text-on-surface">
                {price ? formatMoney(price) : "Цена в аптеке"}
              </span>
              <span className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary text-white transition group-hover/btn:bg-primary-container" aria-label="Добавить в корзину">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
            </button>
          )}
        </div>
      </article>
    </Link>
  );
}
