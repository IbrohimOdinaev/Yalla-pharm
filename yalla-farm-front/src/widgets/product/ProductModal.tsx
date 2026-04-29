"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getMedicineByIdOrSlug,
  getMedicineDisplayName,
  getMainImageUrl,
  getGalleryImages,
  getCheapestPrice,
} from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useAppSelector } from "@/shared/lib/redux";
import { useProductModalStore } from "@/features/product-modal/model/productModalStore";
import { Skeleton } from "@/shared/ui";

/**
 * Global product detail modal. Mounted once by AppShell — every page gets
 * the modal "for free". Driven by `useProductModalStore` (no URL change),
 * replacing the previous Next.js parallel/intercepting-route setup that
 * tripped a framework crash inside `applyRouterStatePatchToTree`.
 *
 * Direct visits / refreshes still hit `/product/[id]/page.tsx` for SEO and
 * shareable links. Card clicks open the modal in-place; modifier-clicks
 * (cmd/ctrl/shift) fall through to the underlying anchor and open the full
 * page in a new tab as the user expects.
 */
export function ProductModal() {
  const productIdOrSlug = useProductModalStore((s) => s.productIdOrSlug);
  const close = useProductModalStore((s) => s.close);

  const token = useAppSelector((s) => s.auth.token);
  const addItem = useCartStore((s) => s.addItem);
  const addGuestItem = useGuestCartStore((s) => s.addItem);

  const [medicine, setMedicine] = useState<ApiMedicine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Reset transient state every time the active product changes; on close
  // (productIdOrSlug → null) we drop the medicine entirely so the next open
  // doesn't flash stale content.
  useEffect(() => {
    if (!productIdOrSlug) {
      setMedicine(null);
      setError(null);
      setQuantity(1);
      setActiveImageIdx(0);
      return;
    }
    setIsLoading(true);
    setError(null);
    setQuantity(1);
    setActiveImageIdx(0);
    getMedicineByIdOrSlug(productIdOrSlug)
      .then((m) => { setMedicine(m); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Ошибка загрузки"); setIsLoading(false); });
  }, [productIdOrSlug]);

  // ESC closes the modal — mounted only while open so we don't leak a
  // listener across the whole session.
  useEffect(() => {
    if (!productIdOrSlug) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [productIdOrSlug, close]);

  // Lock body scroll while open. Restore on close even if the component
  // re-renders during the open lifetime (the cleanup unconditionally clears).
  useEffect(() => {
    if (!productIdOrSlug) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [productIdOrSlug]);

  const gallery = useMemo(() => getGalleryImages(medicine ?? undefined, 800), [medicine]);
  const activeImage = gallery[activeImageIdx] || getMainImageUrl(medicine ?? undefined, 800);
  const cheapestPrice = useMemo(() => getCheapestPrice(medicine ?? undefined), [medicine]);

  const handleAdd = useCallback(() => {
    if (!medicine) return;
    if (token) addItem(token, medicine.id, quantity).catch(() => undefined);
    else addGuestItem(medicine.id, quantity);
    close();
  }, [token, medicine, quantity, addItem, addGuestItem, close]);

  if (!productIdOrSlug) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {isLoading ? (
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
              <div className="flex-shrink-0 sm:w-[280px] lg:w-[320px]">
                <Skeleton className="h-[200px] sm:h-[260px] w-full" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <Skeleton className="h-6 w-4/5" rounded="lg" />
                <Skeleton className="h-3 w-2/5" rounded="md" />
                <Skeleton className="h-8 w-1/3" rounded="lg" />
                <Skeleton className="h-10 w-3/4" rounded="full" />
                <Skeleton className="h-12 w-full" rounded="xl" />
                <Skeleton className="h-12 w-full" rounded="xl" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : medicine ? (
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
              <div className="flex-shrink-0 sm:w-[280px] lg:w-[320px]">
                <div className="relative rounded-xl overflow-hidden bg-white border border-surface-container-high">
                  {activeImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeImage} alt={getMedicineDisplayName(medicine)} className="w-full h-[200px] sm:h-[260px] object-contain" />
                  ) : (
                    <div className="flex h-[200px] sm:h-[260px] items-center justify-center text-on-surface-variant">Нет изображения</div>
                  )}
                </div>
                {gallery.length > 1 ? (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto">
                    {gallery.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIdx(idx)}
                        className={`h-10 w-10 flex-shrink-0 rounded-lg border-2 overflow-hidden transition ${idx === activeImageIdx ? "border-primary" : "border-surface-container-high hover:border-on-surface-variant"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-contain bg-white" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <h2 className="text-lg sm:text-xl font-extrabold text-on-surface pr-8">{getMedicineDisplayName(medicine)}</h2>
                {medicine.articul ? <p className="text-xs font-mono text-on-surface-variant">{medicine.articul}</p> : null}
                {medicine.categoryName ? <p className="text-xs text-on-surface-variant">Категория: <span className="font-medium text-on-surface">{medicine.categoryName}</span></p> : null}

                <p className="text-xl sm:text-2xl font-black text-primary">
                  {cheapestPrice ? `от ${formatMoney(cheapestPrice)}` : "Цена в аптеке"}
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-1 py-1">
                    <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-surface-container-high transition text-on-surface-variant">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <span className="min-w-6 text-center font-bold text-sm">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((q) => q + 1)} className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-surface-container-high transition text-on-surface-variant">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                  <button type="button" onClick={handleAdd} className="stitch-button px-6 py-2.5 text-sm">
                    Добавить
                  </button>
                </div>

                {(medicine.offers ?? []).length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    <h4 className="text-xs font-bold text-on-surface-variant">Цены в аптеках</h4>
                    {medicine.offers!.map((offer) => (
                      <div key={offer.pharmacyId} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <div>
                          <p className="font-semibold">{offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8)}</p>
                          <p className="text-on-surface-variant">В наличии: {offer.stockQuantity} шт.</p>
                        </div>
                        <p className="font-bold text-primary">{formatMoney(offer.price)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {(medicine.description || (medicine.atributes ?? []).length > 0) ? (
              <div className="mt-5 pt-5 border-t border-surface-container-high">
                <div className="flex flex-col sm:flex-row gap-5">
                  {medicine.description ? (
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold mb-2">О товаре</h4>
                      <div className="text-xs text-on-surface-variant prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: medicine.description }} />
                    </div>
                  ) : null}

                  {(medicine.atributes ?? []).length > 0 ? (
                    <div className="flex-shrink-0 sm:w-[280px] lg:w-[320px]">
                      <div className="space-y-1.5">
                        {medicine.atributes!.map((attr, i) => (
                          <div key={i} className="flex justify-between text-xs py-1.5 border-b border-surface-container-high last:border-0">
                            <span className="text-on-surface-variant">{attr.type || attr.name}</span>
                            <span className="font-semibold text-right ml-3">{attr.value || attr.option}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
