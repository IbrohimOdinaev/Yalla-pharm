"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function CartPage() {
  const token = useAppSelector((state) => state.auth.token);
  const { basket, loadBasket, removeItem, setQuantity, isLoading, error } = useCartStore((state) => state);
  const setDraft = useCheckoutDraftStore((state) => state.setDraft);
  const selectedPharmacyId = useCheckoutDraftStore((state) => state.pharmacyId);

  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});

  useEffect(() => {
    if (!token) return;
    loadBasket(token).catch(() => undefined);
  }, [token, loadBasket]);

  useEffect(() => {
    const ids = (basket.positions ?? []).map((item) => item.medicineId);
    if (!ids.length) {
      setMedicineMap({});
      return;
    }

    Promise.all(ids.map((id) => getMedicineById(id).then((medicine) => [id, medicine] as const).catch(() => [id, null] as const)))
      .then((entries) => {
        const next: Record<string, ApiMedicine> = {};
        for (const [id, medicine] of entries) {
          if (medicine) next[id] = medicine;
        }
        setMedicineMap(next);
      })
      .catch(() => undefined);
  }, [basket.positions]);

  const totalCost = useMemo(() => {
    return (basket.positions ?? []).reduce((sum, position) => {
      const medicine = medicineMap[position.medicineId];
      const price = Number(medicine?.price ?? 0);
      return sum + price * Number(position.quantity || 0);
    }, 0);
  }, [basket.positions, medicineMap]);

  if (!token) {
    return (
      <AppShell top={<TopBar title="Корзина" backHref="/" />}>
        <div className="stitch-card p-6 text-sm">
          Для работы с корзиной нужно <Link href="/login" className="font-bold text-primary">войти в аккаунт</Link>.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Корзина" backHref="/" />}>
      <div className="space-y-4">
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {(basket.positions ?? []).length === 0 ? (
          <div className="stitch-card p-6 text-sm">Корзина пустая. Добавьте товары из каталога.</div>
        ) : (
          (basket.positions ?? []).map((position) => {
            const medicine = medicineMap[position.medicineId];
            const image = resolveMedicineImageUrl(medicine);
            const name = medicine ? getMedicineDisplayName(medicine) : `Medicine ${position.medicineId.slice(0, 8)}`;
            const lineCost = Number(medicine?.price ?? 0) * Number(position.quantity || 0);

            return (
              <article key={position.id} className="stitch-card flex gap-4 p-4">
                <div className="h-24 w-24 overflow-hidden rounded-xl bg-surface-container">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-on-surface-variant">Нет фото</div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <h3 className="font-bold">{name}</h3>
                  <p className="text-sm text-on-surface-variant">{formatMoney(lineCost)}</p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="stitch-button-secondary px-3 py-2"
                      onClick={() => setQuantity(token, position.id, Math.max(1, position.quantity - 1)).catch(() => undefined)}
                      disabled={isLoading}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-semibold">{position.quantity}</span>
                    <button
                      type="button"
                      className="stitch-button-secondary px-3 py-2"
                      onClick={() => setQuantity(token, position.id, position.quantity + 1).catch(() => undefined)}
                      disabled={isLoading}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ml-auto rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700"
                      onClick={() => removeItem(token, position.id).catch(() => undefined)}
                      disabled={isLoading}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}

        <section className="stitch-card space-y-3 p-5">
          <h3 className="text-lg font-bold">Итого</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">Сумма товаров</span>
            <span className="font-semibold">{formatMoney(totalCost)}</span>
          </div>

          <div className="rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
            Выбранная аптека: {selectedPharmacyId ? selectedPharmacyId : "не выбрана"}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/pharmacies/map" className="stitch-button-secondary">
              Выбрать аптеку
            </Link>
            <Link
              href="/checkout"
              className="stitch-button"
              onClick={() => {
                const firstOption = (basket.pharmacyOptions ?? [])[0];
                if (firstOption?.pharmacyId && !selectedPharmacyId) {
                  setDraft({ pharmacyId: firstOption.pharmacyId });
                }
              }}
            >
              Перейти к checkout
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
