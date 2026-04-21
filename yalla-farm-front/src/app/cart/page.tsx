"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl, getCheapestPrice, getCatalogMedicinesPaginated } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useBasketLive } from "@/features/cart/model/useBasketLive";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { Button, IconButton, Icon, EmptyState } from "@/shared/ui";

export default function CartPage() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { basket, loadBasket, removeItem, setQuantity, isLoading, error } = useCartStore((state) => state);

  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [recommendations, setRecommendations] = useState<ApiMedicine[]>([]);

  useBasketLive();

  const isGuest = !token;
  const guestItems = useGuestCartStore((s) => s.items);
  const loadGuestCart = useGuestCartStore((s) => s.load);
  const removeGuestItem = useGuestCartStore((s) => s.removeItem);
  const setGuestQuantity = useGuestCartStore((s) => s.setQuantity);

  useEffect(() => {
    if (!token) { loadGuestCart(); return; }
    loadBasket(token).catch(() => undefined);
  }, [token, loadBasket, loadGuestCart]);

  useEffect(() => {
    const serverIds = (basket.positions ?? []).map((item) => item.medicineId);
    const guestIds = isGuest ? guestItems.map((item) => item.medicineId) : [];
    const ids = [...new Set([...serverIds, ...guestIds])];
    if (!ids.length) { setMedicineMap({}); return; }
    Promise.all(ids.map((id) => getMedicineById(id).then((m) => [id, m] as const).catch(() => [id, null] as const)))
      .then((entries) => {
        const next: Record<string, ApiMedicine> = {};
        for (const [id, m] of entries) { if (m) next[id] = m; }
        setMedicineMap(next);
      })
      .catch(() => undefined);
  }, [basket.positions, guestItems, isGuest]);

  const cartItems = useMemo(() => {
    const items = isGuest
      ? guestItems.map((item) => ({ id: item.medicineId, medicineId: item.medicineId, quantity: item.quantity }))
      : (basket.positions ?? []).map((p) => ({ id: p.id, medicineId: p.medicineId, quantity: p.quantity }));
    return [...items].sort((a, b) => {
      const nameA = (medicineMap[a.medicineId]?.title ?? "").toLowerCase();
      const nameB = (medicineMap[b.medicineId]?.title ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [isGuest, guestItems, basket.positions, medicineMap]);

  const cartMinTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = getCheapestPrice(medicineMap[item.medicineId]) ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cartItems, medicineMap]);

  const totalUnits = useMemo(() => cartItems.reduce((n, i) => n + i.quantity, 0), [cartItems]);

  const recommendationsLoaded = useRef(false);
  useEffect(() => {
    if (recommendationsLoaded.current) return;
    const cartMedicineIds = new Set(cartItems.map((i) => i.medicineId));
    const categories = new Set<string>();
    for (const item of cartItems) {
      const m = medicineMap[item.medicineId];
      if (m?.categoryId) categories.add(m.categoryId);
    }
    if (categories.size === 0) return;
    recommendationsLoaded.current = true;
    const catId = [...categories][0];
    getCatalogMedicinesPaginated(1, 12, catId)
      .then((data) => {
        const meds = (data?.medicines ?? []).filter((m: ApiMedicine) => !cartMedicineIds.has(m.id));
        setRecommendations(meds.slice(0, 10));
      })
      .catch(() => undefined);
  }, [cartItems, medicineMap]);

  const onDecrement = useCallback((itemId: string, medicineId: string, qty: number) => {
    if (qty <= 1) {
      if (isGuest) removeGuestItem(medicineId);
      else if (token) removeItem(token, itemId).catch(() => undefined);
    } else {
      if (isGuest) setGuestQuantity(medicineId, qty - 1);
      else if (token) setQuantity(token, itemId, qty - 1).catch(() => undefined);
    }
  }, [isGuest, token, removeGuestItem, removeItem, setGuestQuantity, setQuantity]);

  const onIncrement = useCallback((itemId: string, medicineId: string, qty: number) => {
    if (isGuest) setGuestQuantity(medicineId, qty + 1);
    else if (token) setQuantity(token, itemId, qty + 1).catch(() => undefined);
  }, [isGuest, token, setGuestQuantity, setQuantity]);

  const onRemove = useCallback((itemId: string, medicineId: string) => {
    if (isGuest) removeGuestItem(medicineId);
    else if (token) removeItem(token, itemId).catch(() => undefined);
  }, [isGuest, token, removeGuestItem, removeItem]);

  const clearAll = useCallback(async () => {
    if (isGuest) {
      for (const item of guestItems) removeGuestItem(item.medicineId);
    } else if (token) {
      for (const p of basket.positions ?? []) {
        await removeItem(token, p.id).catch(() => undefined);
      }
    }
  }, [isGuest, token, guestItems, removeGuestItem, basket.positions, removeItem]);

  if (cartItems.length === 0 && !isLoading) {
    return (
      <AppShell top={<TopBar title="Корзина" backHref="back" />}>
        <EmptyState
          icon="cart"
          title="Корзина пустая"
          description="Добавьте товары из каталога, чтобы оформить заказ."
          action={
            <Link href="/">
              <Button size="md" rightIcon="arrow-right">В каталог</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Корзина" backHref="back" />}>
      {/* Header row: total + clear */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant">
            {totalUnits} {totalUnits === 1 ? "товар" : totalUnits < 5 ? "товара" : "товаров"}
          </p>
          <p className="font-display text-xl font-extrabold text-on-surface">
            от {formatMoney(cartMinTotal)} TJS
          </p>
        </div>
        <IconButton
          icon="trash"
          variant="danger"
          size="md"
          onClick={clearAll}
          aria-label="Очистить корзину"
        />
      </div>

      {error ? (
        <div className="mb-3 rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
      ) : null}

      {/* Items list */}
      <ul className="space-y-2">
        {cartItems.map((item) => {
          const medicine = medicineMap[item.medicineId];
          const image = resolveMedicineImageUrl(medicine);
          const name = medicine ? getMedicineDisplayName(medicine) : `Загрузка...`;
          const minPrice = getCheapestPrice(medicine);

          return (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card">
              <Link
                href={`/product/${item.medicineId}`}
                className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-accent-mint"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary/40">
                    <Icon name="bag" size={24} />
                  </div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.medicineId}`}
                  className="line-clamp-2 text-sm font-bold leading-tight text-on-surface transition hover:text-primary"
                >
                  {name}
                </Link>
                <p className="mt-1 text-xs text-on-surface-variant">
                  от{" "}
                  <span className="font-bold text-primary">
                    {minPrice ? `${formatMoney(minPrice)} TJS` : "—"}
                  </span>
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
                  <button
                    type="button"
                    onClick={() => onDecrement(item.id, item.medicineId, item.quantity)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-40"
                    aria-label="Уменьшить"
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-extrabold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrement(item.id, item.medicineId, item.quantity)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95 disabled:opacity-40"
                    aria-label="Увеличить"
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id, item.medicineId)}
                  className="text-[11px] font-semibold text-on-surface-variant/70 transition hover:text-secondary"
                >
                  Удалить
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="mt-8 space-y-3">
          <h3 className="font-display text-lg font-extrabold">Добавьте к заказу</h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 snap-x pb-2">
            {recommendations.map((med) => (
              <div key={med.id} className="w-[140px] flex-shrink-0 snap-start">
                <MedicineCard medicine={med} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Spacer for sticky CTA */}
      <div className="h-24" />

      {/* Sticky CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-3 sm:bottom-4">
        <div className="mx-auto max-w-3xl rounded-full bg-surface-container-lowest p-1.5 shadow-glass">
          <Button
            type="button"
            size="lg"
            fullWidth
            rightIcon="arrow-right"
            onClick={() => router.push("/cart/pharmacy")}
            disabled={cartItems.length === 0}
          >
            Выбрать аптеку · от {formatMoney(cartMinTotal)} TJS
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
