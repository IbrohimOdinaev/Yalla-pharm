"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore, type DraftItem } from "@/features/pharmacist/model/prescriptionDraftStore";
import type { ApiMedicine } from "@/shared/types/api";

// Stable empty fallback so the zustand selector doesn't return a fresh
// `[]` on every render — that would re-trigger the subscription on each
// render and burn a "Maximum update depth exceeded" loop.
const EMPTY_DRAFT_ITEMS: DraftItem[] = [];
import { formatMoney } from "@/shared/lib/format";
import { DEFAULT_MEDICINE_IMAGE_URL, getMedicineDisplayName, getCheapestPrice, imageUrl, imageSrcSet, primeMedicineCache, showDefaultMedicineImage } from "@/entities/medicine/api";
import { Icon } from "@/shared/ui";

type MedicineCardProps = {
  medicine: ApiMedicine;
  hideCart?: boolean;
  compact?: boolean;
  footerAction?: React.ReactNode;
  readOnlyPrice?: number | null;
  readOnlyPricePrefix?: string;
};

// Yandex-Apteka style: flat white card, thin border, red cart button.
export function MedicineCard({ medicine, hideCart, compact, footerAction, readOnlyPrice, readOnlyPricePrefix }: MedicineCardProps) {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const addItem = useCartStore((state) => state.addItem);
  const serverPositions = useCartStore((state) => state.basket.positions);
  const addGuestItem = useGuestCartStore((state) => state.addItem);
  const guestItems = useGuestCartStore((state) => state.items);
  const setGuestQty = useGuestCartStore((state) => state.setQuantity);
  const removeGuestItem = useGuestCartStore((state) => state.removeItem);
  const setServerQty = useCartStore((state) => state.setQuantity);
  const removeServerItem = useCartStore((state) => state.removeItem);

  // Pharmacist context — clicking + on a card adds to the active
  // prescription's draft instead of the regular shopping cart.
  const isPharmacist = role === "Pharmacist";
  const activePrescriptionId = useActivePrescriptionStore((s) => s.activeId);
  const openPicker = useActivePrescriptionStore((s) => s.openPicker);
  const draftItems = usePrescriptionDraftStore((s) =>
    activePrescriptionId ? (s.drafts[activePrescriptionId]?.items ?? EMPTY_DRAFT_ITEMS) : EMPTY_DRAFT_ITEMS);
  const addToDraft = usePrescriptionDraftStore((s) => s.addItem);
  const updateDraftItem = usePrescriptionDraftStore((s) => s.updateItem);
  const removeDraftItem = usePrescriptionDraftStore((s) => s.removeItem);

  // Hold onto the image refs (not pre-built URLs) so we can emit a srcSet
  // alongside src — the browser then picks 480w for normal screens and 800w
  // for retina automatically based on devicePixelRatio.
  const imageRefs = useMemo(() => {
    const imgs = medicine.images ?? [];
    const minimal = imgs.find((i) => i.isMinimal);
    if (minimal) return [minimal];
    const main = imgs.find((i) => i.isMain);
    if (main) return [main];
    return imgs.length > 0 ? imgs : [];
  }, [medicine.images]);
  // 800 px for 1× and 1600 px for retina so even on 3× DPR phones the
  // browser still has more pixels than it needs to draw a crisp image
  // when downscaled into the ~150–220 px card cell. Older 600/1200 was
  // visibly soft on Retina iPads because the asset only covered ~2.7×
  // density once `mix-blend-multiply` filter ran.
  const allImages = useMemo(() => {
    const urls = imageRefs.map((i) => imageUrl(i, 800)).filter(Boolean);
    return urls.length > 0 ? urls : [DEFAULT_MEDICINE_IMAGE_URL];
  }, [imageRefs]);
  const price = getCheapestPrice(medicine);
  const hasReadOnlyPriceOverride = readOnlyPrice !== undefined;
  const displayReadOnlyPrice = hasReadOnlyPriceOverride ? (readOnlyPrice ?? undefined) : price;
  const displayReadOnlyPrefix = readOnlyPricePrefix ?? "от ";
  const offersCount = medicine.offers?.length ?? 0;
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    primeMedicineCache(medicine);
  }, [medicine]);

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
    // Pharmacist: count multiplicity of this medicine in the active draft.
    if (isPharmacist) {
      const matched = draftItems.find((i) => i.medicineId === medicine.id);
      return matched
        ? { inCart: true, quantity: matched.quantity, positionId: matched.draftId }
        : { inCart: false, quantity: 0, positionId: "" };
    }
    if (token) {
      const pos = (serverPositions ?? []).find((p) => p.medicineId === medicine.id);
      return pos ? { inCart: true, quantity: pos.quantity, positionId: pos.id } : { inCart: false, quantity: 0, positionId: "" };
    }
    const item = guestItems.find((i) => i.medicineId === medicine.id);
    return item ? { inCart: true, quantity: item.quantity, positionId: "" } : { inCart: false, quantity: 0, positionId: "" };
  }, [isPharmacist, draftItems, token, serverPositions, guestItems, medicine.id]);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onAdd(e: React.MouseEvent) {
    stop(e);
    if (isPharmacist) {
      if (!activePrescriptionId) { openPicker(); return; }
      addToDraft(activePrescriptionId, {
        draftId: `cat-${medicine.id}-${Date.now()}`,
        medicineId: medicine.id,
        manualMedicineName: null,
        quantity: 1,
        pharmacistComment: null,
        displayTitle: getMedicineDisplayName(medicine),
        minPrice: medicine.minPrice ?? null,
      });
      return;
    }
    if (token) addItem(token, medicine.id).catch(() => undefined);
    else addGuestItem(medicine.id);
  }

  function onIncrement(e: React.MouseEvent) {
    stop(e);
    if (isPharmacist && activePrescriptionId) {
      updateDraftItem(activePrescriptionId, cartState.positionId, { quantity: cartState.quantity + 1 });
      return;
    }
    if (token) {
      // If we already have a real server positionId, take the fast path:
      // setQuantity is fully optimistic and uses a latest-wins reconciler, so
      // rapid clicks stay responsive without queue serialization. Pending or
      // not-yet-added positions go through addItem (also optimistic) where the
      // POST→PATCH ordering matters.
      const hasRealId = cartState.positionId && !cartState.positionId.startsWith("pending:");
      if (hasRealId) {
        setServerQty(token, cartState.positionId, cartState.quantity + 1).catch(() => undefined);
      } else {
        addItem(token, medicine.id).catch(() => undefined);
      }
    } else addGuestItem(medicine.id);
  }

  function onDecrement(e: React.MouseEvent) {
    stop(e);
    if (isPharmacist && activePrescriptionId) {
      const newQty = cartState.quantity - 1;
      if (newQty <= 0) removeDraftItem(activePrescriptionId, cartState.positionId);
      else updateDraftItem(activePrescriptionId, cartState.positionId, { quantity: newQty });
      return;
    }
    const newQty = cartState.quantity - 1;
    if (newQty <= 0) {
      if (token) removeServerItem(token, cartState.positionId).catch(() => undefined);
      else removeGuestItem(medicine.id);
    } else {
      if (token) setServerQty(token, cartState.positionId, newQty).catch(() => undefined);
      else setGuestQty(medicine.id, newQty);
    }
  }

  const name = getMedicineDisplayName(medicine);
  const priceLabel = displayReadOnlyPrice
    ? `${displayReadOnlyPrefix}${formatMoney(displayReadOnlyPrice)}`
    : hideCart
      ? "Нет офферов"
      : "—";
  // Prefer the human-readable slug and fall back to the GUID.
  // /product/[id] resolves either.
  const productKey = medicine.slug || medicine.id;
  const productHref = `/product/${productKey}`;

  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href={productHref}
      className="group block h-full"
    >
      {/* Frame moved from inner image to outer card: a thin border outlines
          the whole card, and the image area now sits flush with the card
          body (no grey contrast block behind the photo). */}
      {/* Tactile feedback: when any inner button (the +/− stepper or the
          blue add pill) is pressed, the whole card briefly grows by ~2 %
          via `has-[button:active]`. The stepper/pill buttons themselves
          stay fixed in size — the user sees the card expand around the
          control without the price/qty text reflowing under their finger. */}
      <article className="flex h-full flex-col rounded-2xl bg-surface-container-lowest transition has-[button:active]:scale-[1.02]">
        {/* Image */}
        <div
          className="relative aspect-square overflow-hidden rounded-2xl bg-product-image-backdrop transition group-active:bg-product-image-backdrop-active"
          onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={onSwipe}
        >
          {allImages.length > 0 ? (
            // `mix-blend-multiply` makes the white bezel that ships baked into
            // most pharmacy product photos blend with the grey card behind,
            // leaving the colourful packaging in the centre crisp and the
            // surrounding "white" pixels reading as the same grey as the
            // image area. That gives us the inset look without shrinking the
            // photo itself — the asset still fills the box at p-2.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={allImages[imgIndex] ?? allImages[0]}
              srcSet={imageSrcSet(imageRefs[imgIndex] ?? imageRefs[0], 800, 1600) || undefined}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={(event) => showDefaultMedicineImage(event.currentTarget)}
              // image-rendering hint nudges Chrome/Edge into a sharper
              // bicubic scaling profile, so the small product packaging stays
              // legible after the browser downscales the 600/1200 px source
              // into the ~150–220 px card cell.
              style={{ imageRendering: "-webkit-optimize-contrast" }}
              className="h-full w-full object-contain p-3 mix-blend-multiply transition group-hover:scale-[1.03]"
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
            <span className="absolute right-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-on-primary shadow-card">
              {cartState.quantity}
            </span>
          ) : null}

          {!hideCart ? (
            cartState.inCart ? (
              <div
                className={`absolute bottom-2 right-2 flex items-center justify-between rounded-full bg-surface/95 text-on-surface shadow-card backdrop-blur-sm ${
                  compact ? "h-9 w-[94px] px-1" : "h-11 w-[112px] px-1.5"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onDecrement}
                  className={`flex shrink-0 items-center justify-center rounded-full transition hover:bg-product-image-backdrop-active ${
                    compact ? "h-7 w-7" : "h-8 w-8"
                  }`}
                  aria-label="Уменьшить"
                >
                  <Icon name="minus" size={14} strokeWidth={2.4} />
                </button>
                <span className="min-w-0 px-1 text-center font-display text-sm font-extrabold tabular-nums">
                  {cartState.quantity}
                </span>
                <button
                  type="button"
                  onClick={onIncrement}
                  className={`flex shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition hover:bg-primary-container ${
                    compact ? "h-7 w-7" : "h-8 w-8"
                  }`}
                  aria-label="Увеличить"
                >
                  <Icon name="plus" size={14} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                className={`absolute bottom-3 right-3 flex items-center justify-center rounded-full bg-surface text-on-surface shadow-card transition hover:bg-product-image-backdrop-active active:scale-95 ${
                  compact ? "h-10 w-10" : "h-12 w-12"
                }`}
                aria-label="В корзину"
              >
                <Icon name="plus" size={compact ? 22 : 26} strokeWidth={2.3} />
              </button>
            )
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
        <div className={`flex flex-1 flex-col ${compact ? "gap-1 p-2.5" : "gap-1.5 p-3"}`}>
          <p
            className={`font-display font-black leading-none text-on-surface ${
              compact ? "text-base xs:text-lg" : "text-lg xs:text-xl"
            }`}
          >
            {priceLabel}
          </p>

          {/* Title — compact Yandex-style text block under the price. */}
          <h3
            className={`font-semibold leading-tight text-on-surface ${
              compact
                ? "line-clamp-2 text-[11px] min-h-[2rem] xs:text-xs"
                : "line-clamp-3 text-[13px] min-h-[3.15rem] xs:text-sm xs:min-h-[3.35rem]"
            }`}
          >
            {name}
          </h3>

          {hideCart && footerAction ? (
            <div className="mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
              {footerAction}
            </div>
          ) : null}
        </div>
      </article>
    </a>
  );
}
