"use client";

import { useMemo, useState, useCallback } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useProductModalStore } from "@/features/product-modal/model/productModalStore";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { getMedicineDisplayName, getMinimalImageUrl, getCheapestPrice, imageUrl } from "@/entities/medicine/api";

type MedicineCardProps = {
  medicine: ApiMedicine;
  hideCart?: boolean;
  compact?: boolean;
};

export function MedicineCard({ medicine, hideCart, compact }: MedicineCardProps) {
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
  const allImages = useMemo(() => {
    const imgs = (medicine.images ?? []).map((i) => imageUrl(i)).filter(Boolean);
    return imgs.length > 0 ? imgs : thumbUrl ? [thumbUrl] : [];
  }, [medicine, thumbUrl]);
  const price = getCheapestPrice(medicine);
  const [imgIndex, setImgIndex] = useState(0);

  const onSwipe = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const startX = (e.currentTarget as HTMLElement).dataset.touchX;
    if (!startX) return;
    const diff = touch.clientX - Number(startX);
    if (Math.abs(diff) < 30) return;
    if (diff < 0 && imgIndex < allImages.length - 1) setImgIndex((i) => i + 1);
    if (diff > 0 && imgIndex > 0) setImgIndex((i) => i - 1);
  }, [imgIndex, allImages.length]);

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

  const openProduct = useProductModalStore((s) => s.open);
  const attrs = (medicine.atributes ?? []).slice(0, 2);

  return (
    <div className="block group h-full cursor-pointer" onClick={() => openProduct(medicine.id)}>
      <article className="h-full flex flex-col rounded-2xl bg-surface-container-lowest shadow-card overflow-hidden transition hover:shadow-glass hover:-translate-y-0.5">
        {/* Image gallery with swipe */}
        <div
          className="relative aspect-square overflow-hidden bg-surface-container"
          onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={onSwipe}
        >
          {allImages.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={allImages[imgIndex] ?? allImages[0]}
              alt={getMedicineDisplayName(medicine)}
              className="h-full w-full object-cover transition group-hover:scale-105 duration-300"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-outline-variant opacity-40 xs:w-10 xs:h-10">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
              </svg>
            </div>
          )}
          {/* Dots indicator */}
          {allImages.length > 1 ? (
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
              {allImages.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition ${i === imgIndex ? "bg-white shadow" : "bg-white/40"}`}
                />
              ))}
            </div>
          ) : null}
          {/* Quantity badge */}
          {cartState.inCart ? (
            <span className={`absolute top-1 left-1 xs:top-1.5 xs:left-1.5 flex items-center justify-center rounded-full bg-primary font-bold text-white shadow-md ${compact ? "h-4 w-4 text-[8px] xs:h-5 xs:w-5 xs:text-[9px]" : "h-4 w-4 text-[8px] xs:h-5 xs:w-5 xs:text-[9px] sm:h-7 sm:w-7 sm:text-xs"}`}>
              {cartState.quantity}
            </span>
          ) : null}
        </div>

        {/* Info */}
        <div className={`flex flex-col flex-1 justify-between ${compact ? "p-1 xs:p-1.5 sm:p-2 space-y-0.5" : "p-1 xs:p-2 sm:p-3 space-y-0.5 sm:space-y-1"}`}>
          <h3 className={`font-bold leading-tight line-clamp-2 ${compact ? "text-[9px] xs:text-[10px] sm:text-[11px] min-h-[1.5rem] xs:min-h-[1.75rem]" : "text-[9px] xs:text-[11px] sm:text-sm min-h-[1.5rem] xs:min-h-[2rem] sm:min-h-[2.5rem]"}`}>{getMedicineDisplayName(medicine)}</h3>

          {!compact && medicine.categoryName ? (
            <p className="text-[10px] text-primary/70 font-medium hidden sm:block">{medicine.categoryName}</p>
          ) : null}

          {!compact && medicine.articul ? (
            <p className="text-[9px] font-mono text-on-surface-variant/60 hidden sm:block">{medicine.articul}</p>
          ) : null}

          {/* Price / Cart controls */}
          {hideCart ? (
            <div className={`rounded-full bg-surface-container-low text-center mt-0.5 xs:mt-1 ${compact ? "px-1 py-0.5 xs:px-1.5 xs:py-1" : "px-1.5 py-1 xs:px-2 xs:py-1.5 sm:px-3 sm:py-2"}`}>
              <span className={`font-bold text-on-surface ${compact ? "text-[8px] xs:text-[10px]" : "text-[8px] xs:text-[11px] sm:text-sm"}`}>
                {price ? `от ${formatMoney(price)}` : "Нет офферов"}
              </span>
            </div>
          ) : cartState.inCart ? (
            <div
              className="flex items-center justify-between rounded-full bg-primary/10 px-0.5 py-0.5 mt-0.5 xs:mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onDecrement}
                className={`flex items-center justify-center rounded-full text-primary hover:bg-primary/20 transition ${compact ? "h-5 w-5 xs:h-6 xs:w-6" : "h-5 w-5 xs:h-6 xs:w-6 sm:h-8 sm:w-8"}`}
                aria-label="Уменьшить"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="xs:w-3.5 xs:h-3.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <span className={`font-bold text-primary ${compact ? "text-[8px] xs:text-[10px]" : "text-[8px] xs:text-[11px] sm:text-sm"}`}>
                {price ? `от ${formatMoney(price)}` : "—"}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                className={`flex items-center justify-center rounded-full text-primary hover:bg-primary/20 transition ${compact ? "h-5 w-5 xs:h-6 xs:w-6" : "h-5 w-5 xs:h-6 xs:w-6 sm:h-8 sm:w-8"}`}
                aria-label="Увеличить"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="xs:w-3.5 xs:h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="flex w-full items-center justify-between rounded-full bg-surface-container-low px-0.5 py-0.5 mt-0.5 xs:mt-1 transition hover:bg-surface-container-high group/btn"
            >
              <span className={`pl-1 xs:pl-1.5 font-bold text-on-surface ${compact ? "text-[9px] xs:text-[10px]" : "text-[9px] xs:text-[11px] sm:text-sm sm:pl-3"}`}>
                {price ? `от ${formatMoney(price)}` : "Цена"}
              </span>
              <span className={`flex items-center justify-center rounded-full bg-primary text-white transition group-hover/btn:bg-primary-container ${compact ? "h-5 w-5 xs:h-6 xs:w-6" : "h-5 w-5 xs:h-7 xs:w-7 sm:h-8 sm:w-8"}`} aria-label="Добавить в корзину">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="xs:w-3.5 xs:h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
            </button>
          )}
        </div>
      </article>
    </div>
  );
}
