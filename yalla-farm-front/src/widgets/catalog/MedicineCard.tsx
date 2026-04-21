"use client";

import { useMemo, useState, useCallback } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useProductModalStore } from "@/features/product-modal/model/productModalStore";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { getMedicineDisplayName, getMinimalImageUrl, getCheapestPrice, imageUrl } from "@/entities/medicine/api";
import { Icon } from "@/shared/ui";

type MedicineCardProps = {
  medicine: ApiMedicine;
  hideCart?: boolean;
  compact?: boolean;
};

// Yandex-Apteka style: flat white card, thin border, red cart button.
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
  const offersCount = medicine.offers?.length ?? 0;
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

  const cartState = useMemo(() => {
    if (token) {
      const pos = (serverPositions ?? []).find((p) => p.medicineId === medicine.id);
      return pos ? { inCart: true, quantity: pos.quantity, positionId: pos.id } : { inCart: false, quantity: 0, positionId: "" };
    }
    const item = guestItems.find((i) => i.medicineId === medicine.id);
    return item ? { inCart: true, quantity: item.quantity, positionId: "" } : { inCart: false, quantity: 0, positionId: "" };
  }, [token, serverPositions, guestItems, medicine.id]);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onAdd(e: React.MouseEvent) {
    stop(e);
    if (token) addItem(token, medicine.id).catch(() => undefined);
    else addGuestItem(medicine.id);
  }

  function onIncrement(e: React.MouseEvent) {
    stop(e);
    if (token) addItem(token, medicine.id).catch(() => undefined);
    else addGuestItem(medicine.id);
  }

  function onDecrement(e: React.MouseEvent) {
    stop(e);
    const newQty = cartState.quantity - 1;
    if (newQty <= 0) {
      if (token) removeServerItem(token, cartState.positionId).catch(() => undefined);
      else removeGuestItem(medicine.id);
    } else {
      if (token) setServerQty(token, cartState.positionId, newQty).catch(() => undefined);
      else setGuestQty(medicine.id, newQty);
    }
  }

  const openProduct = useProductModalStore((s) => s.open);
  const name = getMedicineDisplayName(medicine);

  return (
    <div
      className="group h-full cursor-pointer"
      onClick={() => openProduct(medicine.id)}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-outline/50 bg-surface-container-lowest transition hover:border-on-surface/30 hover:shadow-card">
        {/* Image */}
        <div
          className="relative aspect-square overflow-hidden bg-surface-container-low"
          onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={onSwipe}
        >
          {allImages.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={allImages[imgIndex] ?? allImages[0]}
              alt={name}
              className="h-full w-full object-contain p-2 transition group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-on-surface-variant/40">
              <Icon name="pharmacy" size={40} />
            </div>
          )}

          {/* Offers count pill — top-left */}
          {offersCount > 1 ? (
            <span className="absolute left-2 top-2 rounded-full bg-surface-container-lowest/95 px-2 py-0.5 text-[10px] font-bold text-on-surface shadow-card">
              в {offersCount} {offersCount < 5 ? "аптеках" : "аптеках"}
            </span>
          ) : null}

          {/* Quantity badge when in cart */}
          {cartState.inCart ? (
            <span className="absolute right-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-white">
              {cartState.quantity}
            </span>
          ) : null}

          {/* Image dots */}
          {allImages.length > 1 ? (
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
              {allImages.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition ${i === imgIndex ? "w-3 bg-on-surface/60" : "w-1 bg-on-surface/25"}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div className={`flex flex-1 flex-col ${compact ? "gap-1 p-2" : "gap-1.5 p-3"}`}>
          {/* Category or pharmacy hint */}
          {medicine.categoryName && !compact ? (
            <p className="hidden truncate text-[10px] font-semibold text-on-surface-variant sm:block">
              {medicine.categoryName}
            </p>
          ) : null}

          {/* Title */}
          <h3
            className={`line-clamp-2 font-semibold leading-tight text-on-surface ${
              compact ? "text-[11px] min-h-[1.8rem]" : "text-[12px] sm:text-[13px] min-h-[2rem] sm:min-h-[2.2rem]"
            }`}
          >
            {name}
          </h3>

          {/* Price */}
          <div className="mt-auto flex items-baseline gap-1.5">
            <span
              className={`font-display font-extrabold text-on-surface tabular-nums ${
                compact ? "text-sm" : "text-base sm:text-lg"
              }`}
            >
              {price ? `${formatMoney(price)}` : "—"}
            </span>
            {price ? (
              <span className="text-[11px] font-semibold text-on-surface-variant">TJS</span>
            ) : null}
          </div>

          {/* Cart button / controls */}
          {hideCart ? (
            <div className="rounded-full bg-surface-container py-1.5 text-center">
              <span className="text-[11px] font-bold text-on-surface">
                {price ? `от ${formatMoney(price)}` : "Нет офферов"}
              </span>
            </div>
          ) : cartState.inCart ? (
            <div
              className="flex items-center justify-between rounded-full bg-primary p-0.5 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onDecrement}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95"
                aria-label="Уменьшить"
              >
                <Icon name="minus" size={14} />
              </button>
              <span className={`font-extrabold tabular-nums ${compact ? "text-xs" : "text-sm"}`}>
                {cartState.quantity}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95"
                aria-label="Увеличить"
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className={`flex w-full items-center justify-center gap-1.5 rounded-full bg-secondary font-bold text-white transition hover:bg-secondary-container active:scale-[0.98] ${
                compact ? "h-8 text-[11px]" : "h-9 text-xs"
              }`}
            >
              <Icon name="bag" size={compact ? 12 : 14} />
              В корзину
            </button>
          )}
        </div>
      </article>
    </div>
  );
}
