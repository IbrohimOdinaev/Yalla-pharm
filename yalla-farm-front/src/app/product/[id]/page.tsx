"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { useAppSelector } from "@/shared/lib/redux";
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

  const [medicine, setMedicine] = useState<ApiMedicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const imageUrl = useMemo(() => resolveMedicineImageUrl(medicine ?? undefined), [medicine]);

  return (
    <AppShell top={<TopBar title="Карточка товара" backHref="/" />}>
      {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товар...</div> : null}
      {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

      {medicine ? (
        <section className="space-y-5">
          <div className="overflow-hidden rounded-2xl bg-surface-container-high shadow-card">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={getMedicineDisplayName(medicine)} className="h-[320px] w-full object-cover" />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-on-surface-variant">Нет изображения</div>
            )}
          </div>

          <div className="stitch-card space-y-4 p-6">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">{getMedicineDisplayName(medicine)}</h1>
              {medicine.articul ? <p className="mt-1 text-xs font-mono text-on-surface-variant">{medicine.articul}</p> : null}
              {medicine.description ? <p className="mt-2 text-sm text-on-surface-variant">{medicine.description}</p> : null}
            </div>

            {/* Attributes from API */}
            {(medicine.atributes ?? []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {medicine.atributes!.map((attr) => (
                  <div key={attr.name} className="rounded-xl bg-surface-container-low p-3">
                    <p className="text-xs text-on-surface-variant">{attr.name}</p>
                    <p className="font-semibold">{attr.option}</p>
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

            <div className="flex items-center justify-between gap-4">
              <p className="text-2xl font-black text-primary">
                {medicine.price ? formatMoney(medicine.price)
                  : medicine.offers?.[0]?.price ? formatMoney(medicine.offers[0].price)
                  : "Цена в аптеке"}
              </p>
              <button
                type="button"
                className="stitch-button"
                onClick={() => {
                  if (token) {
                    addItem(token, medicine.id).catch(() => undefined);
                  } else {
                    addGuestItem(medicine.id);
                  }
                }}
              >
                Добавить в корзину
              </button>
            </div>
          </div>

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
