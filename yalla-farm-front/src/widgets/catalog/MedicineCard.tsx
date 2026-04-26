"use client";

import { useMemo, useState, useCallback } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useProductModalStore } from "@/features/product-modal/model/productModalStore";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { getMedicineDisplayName, getCheapestPrice, imageUrl, imageSrcSet } from "@/entities/medicine/api";
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

  // Hold onto the image refs (not pre-built URLs) so we can emit a srcSet
  // alongside src — the browser then picks 480w for normal screens and 800w
  // for retina automatically based on devicePixelRatio.
  const imageRefs = useMemo(() => {
    const imgs = medicine.images ?? [];
    if (imgs.length > 0) return imgs;
    // Fallback chain: minimal → main → first
    const minimal = imgs.find((i) => i.isMinimal);
    if (minimal) return [minimal];
    const main = imgs.find((i) => i.isMain);
    if (main) return [main];
    return imgs[0] ? [imgs[0]] : [];
  }, [medicine.images]);
  const allImages = useMemo(() => imageRefs.map((i) => imageUrl(i, 480)).filter(Boolean), [imageRefs]);
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
              srcSet={imageSrcSet(imageRefs[imgIndex] ?? imageRefs[0], 480, 800) || undefined}
              alt={name}
              loading="lazy"
              decoding="async"
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

          {/* Quantity badge when in cart — light-blue pill, top-right. */}
          {cartState.inCart ? (
            <span className="absolute right-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#4FB8DD] px-1.5 text-[11px] font-extrabold text-white shadow-card">
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
        <div className={`flex flex-1 flex-col ${compact ? "gap-1.5 p-2.5" : "gap-2 p-3"}`}>
          {/* Category hint (non-compact wide layouts only) */}
          {medicine.categoryName && !compact ? (
            <p className="hidden truncate text-[10px] font-semibold text-on-surface-variant sm:block">
              {medicine.categoryName}
            </p>
          ) : null}

          {/* Title */}
          <h3
            className={`line-clamp-2 font-semibold leading-tight text-on-surface ${
              compact ? "text-xs min-h-[2rem]" : "text-sm min-h-[2.4rem]"
            }`}
          >
            {name}
          </h3>

          {/* Cart control — price lives inside the pill. Default state: light-blue
              pill with "{price} TJS  +"; in-cart state: yellow pill with
              "−  {price} TJS  +". Admin-side cards (hideCart) get a static
              read-only price strip. */}
          <div className="mt-auto">
            {hideCart ? (
              <div className="flex items-center justify-center rounded-full bg-surface-container py-2">
                <span className="text-xs font-bold text-on-surface">
                  {price ? `от ${formatMoney(price)}` : "Нет офферов"}
                </span>
              </div>
            ) : cartState.inCart ? (
              <div
                className={`flex items-center justify-between gap-1 rounded-full bg-accent px-0 text-on-surface shadow-card xs:gap-1.5 sm:gap-2 sm:px-0.5 md:px-1 ${
                  compact ? "h-7 sm:h-8 md:h-9" : "h-8 sm:h-9 md:h-10"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onDecrement}
                  className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-on-surface/10 active:scale-95 sm:h-7 sm:w-7 md:h-8 md:w-8"
                  aria-label="Уменьшить"
                >
                  <Icon name="minus" size={12} strokeWidth={2.4} />
                </button>
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-center font-display font-extrabold tabular-nums whitespace-nowrap leading-none ${
                    compact
                      ? "text-[8px] xs:text-[9px] sm:text-[10px] md:text-[11px]"
                      : "text-[9px] xs:text-[10px] sm:text-[11px] md:text-xs lg:text-sm"
                  }`}
                >
                  {price ? `${formatMoney(price)}` : `×${cartState.quantity}`}
                </span>
                <button
                  type="button"
                  onClick={onIncrement}
                  className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-on-surface/10 active:scale-95 sm:h-7 sm:w-7 md:h-8 md:w-8"
                  aria-label="Увеличить"
                >
                  <Icon name="plus" size={12} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                className={`flex w-full items-center justify-between gap-0.5 rounded-full bg-[#4FB8DD] px-2 font-display text-white shadow-card transition hover:bg-[#3FA5CE] active:scale-[0.98] xs:gap-1 xs:px-3 ${
                  compact ? "h-8 xs:h-9" : "h-9 xs:h-10"
                }`}
                aria-label="В корзину"
              >
                <span
                  className={`font-extrabold tabular-nums whitespace-nowrap leading-none ${
                    compact
                      ? "text-[9px] xs:text-[10px] sm:text-[11px]"
                      : "text-[10px] xs:text-[11px] sm:text-xs md:text-sm"
                  }`}
                >
                  {price ? formatMoney(price) : "—"}
                </span>
                <Icon name="plus" size={14} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
