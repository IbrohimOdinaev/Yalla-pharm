"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMedicineById, getMedicineDisplayName, getMainImageUrl, getGalleryImages, getCheapestPrice } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useAppSelector } from "@/shared/lib/redux";
import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const token = useAppSelector((state) => state.auth.token);
  const addItem = useCartStore((state) => state.addItem);
  const addGuestItem = useGuestCartStore((state) => state.addItem);

  const role = useAppSelector((state) => state.auth.role);

  const [medicine, setMedicine] = useState<ApiMedicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useOfferLiveUpdates(useCallback((payload) => {
    if (medicine && payload.medicineId === medicine.id) {
      getMedicineById(id).then(setMedicine).catch(() => undefined);
    }
  }, [medicine, id]));

  useEffect(() => {
    if (!id) {
      setError("Некорректный идентификатор товара.");
      setIsLoading(false);
      return;
    }

    getMedicineById(id)
      .then((value) => {
        setMedicine(value);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить товар.");
        setIsLoading(false);
      });
  }, [id]);

  const gallery = useMemo(() => getGalleryImages(medicine ?? undefined), [medicine]);
  const activeImage = gallery[activeImageIdx] || getMainImageUrl(medicine ?? undefined);
  const cheapestPrice = useMemo(() => getCheapestPrice(medicine ?? undefined), [medicine]);

  return (
    <AppShell top={<TopBar title="Карточка товара" backHref="back" />}>
      {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товар...</div> : null}
      {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

      {medicine ? (
        <section className="space-y-3 xs:space-y-4 sm:space-y-5">
          {/* Image gallery */}
          <div className="space-y-2 xs:space-y-3">
            <div
              className="relative overflow-hidden rounded-2xl bg-surface-container-high shadow-card"
              onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0].clientX); }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as HTMLElement).dataset.touchX;
                if (!startX) return;
                const diff = e.changedTouches[0].clientX - Number(startX);
                if (Math.abs(diff) < 40) return;
                if (diff < 0 && activeImageIdx < gallery.length - 1) setActiveImageIdx((i) => i + 1);
                if (diff > 0 && activeImageIdx > 0) setActiveImageIdx((i) => i - 1);
              }}
            >
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeImage} alt={getMedicineDisplayName(medicine)} className="h-[180px] xs:h-[220px] sm:h-[360px] w-full object-contain bg-white" />
              ) : (
                <div className="flex h-[180px] xs:h-[220px] sm:h-[360px] items-center justify-center text-on-surface-variant">Нет изображения</div>
              )}
              {/* Arrow buttons */}
              {gallery.length > 1 ? (
                <>
                  {activeImageIdx > 0 && (
                    <button type="button" onClick={() => setActiveImageIdx((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                  )}
                  {activeImageIdx < gallery.length - 1 && (
                    <button type="button" onClick={() => setActiveImageIdx((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  )}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {gallery.map((_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full transition ${i === activeImageIdx ? "bg-primary shadow" : "bg-white/50"}`} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            {gallery.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {gallery.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`h-10 w-10 xs:h-12 xs:w-12 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      idx === activeImageIdx ? "border-primary shadow-sm" : "border-surface-container-high hover:border-on-surface-variant"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-contain bg-white" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="stitch-card space-y-3 xs:space-y-4 p-3 xs:p-4 sm:p-5">
            <div>
              <h1 className="text-base xs:text-lg sm:text-xl font-extrabold text-primary">{getMedicineDisplayName(medicine)}</h1>
              {medicine.articul ? <p className="mt-1 text-xs xs:text-sm font-mono text-on-surface-variant">{medicine.articul}</p> : null}
              {medicine.categoryName ? <p className="mt-1 text-xs xs:text-sm text-on-surface-variant">Категория: <span className="font-medium text-on-surface">{medicine.categoryName}</span></p> : null}
              {medicine.description ? (
                <div className="mt-2 text-xs xs:text-sm text-on-surface-variant prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: medicine.description }} />
              ) : null}
            </div>

            {/* Attributes */}
            {(medicine.atributes ?? []).length > 0 ? (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5 xs:gap-2 text-[10px] xs:text-xs sm:text-sm">
                {medicine.atributes!.map((attr, i) => (
                  <div key={i} className="rounded-xl bg-surface-container-low p-2 xs:p-3">
                    <p className="text-xs text-on-surface-variant">{attr.type || attr.name}</p>
                    <p className="font-semibold">{attr.value || attr.option}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Offers from pharmacies */}
            {(medicine.offers ?? []).length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs xs:text-sm font-bold text-on-surface-variant">Цены в аптеках</h3>
                {medicine.offers!.map((offer) => (
                  <div key={offer.pharmacyId} className="flex items-center justify-between rounded-xl bg-surface-container-low px-2 xs:px-3 py-1.5 xs:py-2.5 gap-2">
                    <div>
                      <p className="font-semibold text-xs xs:text-sm">{offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8)}</p>
                      <p className="text-xs text-on-surface-variant">В наличии: {offer.stockQuantity} шт.</p>
                    </div>
                    <p className="font-bold text-primary">{formatMoney(offer.price)}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="text-base xs:text-lg sm:text-2xl font-black text-primary">
              {cheapestPrice ? formatMoney(cheapestPrice) : "Цена в аптеке"}
              {(medicine.offers ?? []).length > 1 ? <span className="ml-2 text-xs font-normal text-on-surface-variant">от</span> : null}
            </p>

            <div className="flex items-center gap-1.5 xs:gap-2">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="stitch-button-secondary px-2 xs:px-2.5 py-1 xs:py-1.5 text-xs">−</button>
              <span className="min-w-6 xs:min-w-8 text-center font-semibold text-xs xs:text-sm">{quantity}</span>
              <button type="button" onClick={() => setQuantity(q => q + 1)} className="stitch-button-secondary px-2 xs:px-3 py-1.5 xs:py-2 text-xs xs:text-sm">+</button>
            </div>

            <button
              type="button"
              className="stitch-button w-full text-xs xs:text-sm sm:text-base"
              onClick={() => {
                if (token) {
                  addItem(token, medicine.id, quantity).catch(() => undefined);
                } else {
                  addGuestItem(medicine.id, quantity);
                }
              }}
            >
              Добавить в корзину
            </button>
          </div>

          {/* Admin/SuperAdmin tip */}
          {(role === "Admin" || role === "SuperAdmin") ? (
            <div className="rounded-2xl bg-surface-container-low p-3 xs:p-4 sm:p-5 space-y-2">
              <p className="text-sm font-bold text-on-surface-variant">Режим {role === "Admin" ? "Администратора" : "Суперадмина"}</p>
              <p className="text-xs text-on-surface-variant">Управление этим товаром доступно в вашем кабинете.</p>
              <Link href={role === "Admin" ? "/workspace" : "/superadmin"} className="stitch-button-secondary inline-block text-xs">Открыть кабинет</Link>
            </div>
          ) : null}

        </section>
      ) : null}
    </AppShell>
  );
}
