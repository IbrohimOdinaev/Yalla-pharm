"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMedicineById, getMedicineDisplayName, getMainImageUrl, getGalleryImages, getCheapestPrice } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
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
  const basket = useCartStore((state) => state.basket);
  const loadBasket = useCartStore((state) => state.loadBasket);
  const setDraft = useCheckoutDraftStore((state) => state.setDraft);

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
    if (token) loadBasket(token).catch(() => undefined);
  }, [token, loadBasket]);

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
    <AppShell top={<TopBar title="Карточка товара" backHref="/" />}>
      {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товар...</div> : null}
      {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

      {medicine ? (
        <section className="space-y-5">
          {/* Image gallery */}
          <div className="space-y-3">
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
                <img src={activeImage} alt={getMedicineDisplayName(medicine)} className="h-[250px] sm:h-[360px] w-full object-contain bg-white" />
              ) : (
                <div className="flex h-[250px] sm:h-[360px] items-center justify-center text-on-surface-variant">Нет изображения</div>
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
                    className={`h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
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

          <div className="stitch-card space-y-4 p-6">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">{getMedicineDisplayName(medicine)}</h1>
              {medicine.articul ? <p className="mt-1 text-xs font-mono text-on-surface-variant">{medicine.articul}</p> : null}
              {medicine.categoryName ? <p className="mt-1 text-sm text-on-surface-variant">Категория: <span className="font-medium text-on-surface">{medicine.categoryName}</span></p> : null}
              {medicine.description ? (
                <div className="mt-2 text-sm text-on-surface-variant prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: medicine.description }} />
              ) : null}
            </div>

            {/* Attributes */}
            {(medicine.atributes ?? []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {medicine.atributes!.map((attr, i) => (
                  <div key={i} className="rounded-xl bg-surface-container-low p-3">
                    <p className="text-xs text-on-surface-variant">{attr.type || attr.name}</p>
                    <p className="font-semibold">{attr.value || attr.option}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Offers from pharmacies */}
            {(medicine.offers ?? []).length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-on-surface-variant">Цены в аптеках</h3>
                {medicine.offers!.map((offer) => (
                  <div key={offer.pharmacyId} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                    <div>
                      <p className="font-semibold text-sm">{offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8)}</p>
                      <p className="text-xs text-on-surface-variant">В наличии: {offer.stockQuantity} шт.</p>
                    </div>
                    <p className="font-bold text-primary">{formatMoney(offer.price)}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="text-2xl font-black text-primary">
              {cheapestPrice ? formatMoney(cheapestPrice) : "Цена в аптеке"}
              {(medicine.offers ?? []).length > 1 ? <span className="ml-2 text-xs font-normal text-on-surface-variant">от</span> : null}
            </p>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="stitch-button-secondary px-3 py-2">−</button>
              <span className="min-w-8 text-center font-semibold">{quantity}</span>
              <button type="button" onClick={() => setQuantity(q => q + 1)} className="stitch-button-secondary px-3 py-2">+</button>
            </div>

            <button
              type="button"
              className="stitch-button w-full"
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
            <div className="rounded-2xl bg-surface-container-low p-5 space-y-2">
              <p className="text-sm font-bold text-on-surface-variant">Режим {role === "Admin" ? "Администратора" : "Суперадмина"}</p>
              <p className="text-xs text-on-surface-variant">Управление этим товаром доступно в вашем кабинете.</p>
              <Link href={role === "Admin" ? "/workspace" : "/superadmin"} className="stitch-button-secondary inline-block text-xs">Открыть кабинет</Link>
            </div>
          ) : null}

          {/* Pharmacy offers comparison */}
          {token && (basket.pharmacyOptions ?? []).length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Доступно в аптеках</h2>
              {(basket.pharmacyOptions ?? []).map((option) => {
                const ratio = option.foundMedicinesRatio ?? `${option.foundMedicinesCount ?? 0}/${option.totalMedicinesCount ?? 0}`;
                const allAvailable = option.foundMedicinesCount === option.totalMedicinesCount;
                return (
                  <div key={option.pharmacyId} className="flex items-center justify-between rounded-xl bg-surface-container-low p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{option.pharmacyTitle ?? option.pharmacyId.slice(0, 8)}</p>
                      <p className="text-xs text-on-surface-variant">{option.pharmacyAddress ?? ""}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${allAvailable ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {ratio} в наличии
                        </span>
                        <span className="font-bold text-primary">{formatMoney(option.totalCost)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ml-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
                      onClick={() => setDraft({ pharmacyId: option.pharmacyId })}
                    >
                      Выбрать
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
