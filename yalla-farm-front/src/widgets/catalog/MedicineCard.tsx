"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
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

  const name = getMedicineDisplayName(medicine);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Prefer the human-readable slug from WooCommerce — falls back to the GUID
  // for medicines that haven't synced yet. /product/[id] resolves either.
  const productKey = medicine.slug || medicine.id;
  const productHref = `/product/${productKey}`;

  function onCardClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Modifier-click → let the anchor's default behavior open
    // /product/{slug} in a new tab. Plain left-click intercepts and
    // pushes ?product={slug} into the current URL so the global
    // ProductModal opens in place. Implementation detail: we use
    // router.replace when a product modal is ALREADY open (replacing
    // one product with another shouldn't add a history entry per click,
    // otherwise back-button would step through every product viewed
    // before closing the modal). On first open we use router.push so
    // browser-back closes the modal naturally.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const wasOpen = params.has("product");
    if (params.get("product") === productKey) return; // same product → no-op
    params.set("product", productKey);
    const url = `${pathname}?${params.toString()}`;
    if (wasOpen) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }

  // Plain <a> rather than Next.js <Link> so we don't trigger client-side
  // navigation on click — the anchor exists purely for SEO crawlers
  // and middle-/right-click "open in new tab" flows. Cart buttons below
  // call e.preventDefault() to suppress the modal trigger when toggling
  // quantities inside the card.
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href={productHref}
      onClick={onCardClick}
      className="group block h-full"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface-container-lowest transition hover:shadow-card">
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

          {/* Title — wider card on 2-col phone layout fits 3 lines on the
              non-compact variant; compact (search-result fixed-width cards)
              still clamps to 2 since their column is narrower. min-h locks
              the row height so prices align across cards regardless of how
              many lines a title actually wraps to. */}
          <h3
            className={`font-semibold leading-tight text-on-surface ${
              compact
                ? "line-clamp-2 text-[11px] min-h-[2rem] xs:text-xs"
                : "line-clamp-3 text-[13px] min-h-[3.6rem] xs:text-sm xs:min-h-[3.8rem]"
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
              // Yellow in-cart pill — kept the same height + full-width as
              // the blue add pill below so toggling between states doesn't
              // jiggle the card row. Heights / breakpoints mirror the blue
              // variant exactly.
              <div
                className={`flex w-full items-center justify-between gap-0.5 rounded-full bg-accent px-1 text-on-surface shadow-card xs:gap-1 xs:px-1.5 ${
                  compact ? "h-8 xs:h-9" : "h-9 xs:h-10"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onDecrement}
                  className={`flex shrink-0 items-center justify-center rounded-full transition hover:bg-on-surface/10 active:scale-95 ${
                    compact ? "h-6 w-6 xs:h-7 xs:w-7" : "h-7 w-7 xs:h-8 xs:w-8"
                  }`}
                  aria-label="Уменьшить"
                >
                  <Icon name="minus" size={14} strokeWidth={2.4} />
                </button>
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-center font-display font-extrabold tabular-nums whitespace-nowrap leading-none ${
                    compact
                      ? "text-[10px] xs:text-[11px] sm:text-xs"
                      : "text-[11px] xs:text-xs sm:text-sm"
                  }`}
                >
                  {price ? `${formatMoney(price)}` : `×${cartState.quantity}`}
                </span>
                <button
                  type="button"
                  onClick={onIncrement}
                  className={`flex shrink-0 items-center justify-center rounded-full transition hover:bg-on-surface/10 active:scale-95 ${
                    compact ? "h-6 w-6 xs:h-7 xs:w-7" : "h-7 w-7 xs:h-8 xs:w-8"
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
    </a>
  );
}
