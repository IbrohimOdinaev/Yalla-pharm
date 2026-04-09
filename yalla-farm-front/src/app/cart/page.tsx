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

export default function CartPage() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { basket, loadBasket, removeItem, setQuantity, isLoading, error } = useCartStore((state) => state);
  const addItem = useCartStore((state) => state.addItem);

  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [recommendations, setRecommendations] = useState<ApiMedicine[]>([]);

  useBasketLive();

  const isGuest = !token;
  const guestItems = useGuestCartStore((s) => s.items);
  const loadGuestCart = useGuestCartStore((s) => s.load);
  const removeGuestItem = useGuestCartStore((s) => s.removeItem);
  const setGuestQuantity = useGuestCartStore((s) => s.setQuantity);
  const addGuestItem = useGuestCartStore((s) => s.addItem);

  useEffect(() => {
    if (!token) { loadGuestCart(); return; }
    loadBasket(token).catch(() => undefined);
  }, [token, loadBasket, loadGuestCart]);

  // Load medicine details
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

  // Unified cart items — sorted by medicine name
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

  // Min total price across all pharmacies
  const cartMinTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = getCheapestPrice(medicineMap[item.medicineId]) ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cartItems, medicineMap]);

  // Load recommendations once based on cart categories
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

  // Handlers
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
      // Remove items one by one (clearBasket not exposed in store)
      for (const p of basket.positions ?? []) {
        await removeItem(token, p.id).catch(() => undefined);
      }
    }
  }, [isGuest, token, guestItems, removeGuestItem, basket.positions, removeItem]);

  // Empty cart
  if (cartItems.length === 0 && !isLoading) {
    return (
      <AppShell top={<TopBar title="Корзина" backHref="back" />}>
        <div className="flex flex-col items-center gap-4 py-12">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-on-surface-variant/40">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <p className="text-sm text-on-surface-variant">Корзина пустая</p>
          <Link href="/" className="stitch-button text-sm">Перейти в каталог</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={
      <TopBar title="Заказ" backHref="back" />
    }>
      <div className="space-y-1">
        {/* Header with total + clear */}
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs xs:text-sm text-on-surface-variant">
            от <span className="font-bold text-on-surface">{formatMoney(cartMinTotal)}</span>
          </p>
          <button type="button" onClick={clearAll} className="text-on-surface-variant hover:text-red-600 transition p-1" aria-label="Очистить корзину">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>

        {error ? <div className="rounded-xl bg-red-100 p-2 xs:p-3 text-xs text-red-700">{error}</div> : null}

        {/* Cart items — clean list */}
        <div className="divide-y divide-surface-container-high">
          {cartItems.map((item) => {
            const medicine = medicineMap[item.medicineId];
            const image = resolveMedicineImageUrl(medicine);
            const name = medicine ? getMedicineDisplayName(medicine) : `Товар...`;
            const minPrice = getCheapestPrice(medicine);

            return (
              <div key={item.id} className="flex items-center gap-1.5 xs:gap-2.5 py-2.5 xs:py-3.5">
                {/* Image */}
                <Link href={`/product/${item.medicineId}`} className="h-12 w-12 xs:h-14 xs:w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-outline opacity-40">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                      </svg>
                    </div>
                  )}
                </Link>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.medicineId}`} className="text-xs xs:text-sm font-bold leading-tight line-clamp-2 hover:text-primary transition">
                    {name}
                  </Link>
                  <p className="text-xs xs:text-sm text-on-surface-variant mt-0.5">
                    от <span className="font-bold text-on-surface">{minPrice ? formatMoney(minPrice) : "—"}</span>
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-0 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onDecrement(item.id, item.medicineId, item.quantity)}
                    disabled={!isGuest && isLoading}
                    className="flex h-7 w-7 xs:h-9 xs:w-9 sm:h-10 sm:w-10 items-center justify-center rounded-l-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition text-base xs:text-lg font-bold"
                  >
                    &#8722;
                  </button>
                  <span className="flex h-7 xs:h-9 sm:h-10 min-w-[1.5rem] xs:min-w-[2rem] items-center justify-center bg-surface-container-low text-[10px] xs:text-xs sm:text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrement(item.id, item.medicineId, item.quantity)}
                    disabled={!isGuest && isLoading}
                    className="flex h-7 w-7 xs:h-9 xs:w-9 sm:h-10 sm:w-10 items-center justify-center rounded-r-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition text-base xs:text-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="pt-4 xs:pt-5 space-y-2 xs:space-y-3">
            <div className="h-px bg-surface-container-high" />
            <h3 className="text-base xs:text-lg font-black pt-1">Что-то ещё?</h3>
            <div className="flex gap-1.5 xs:gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-touch -mx-1.5 px-1.5 xs:-mx-3 xs:px-3 snap-x">
              {recommendations.map((med) => (
                <div key={med.id} className="w-[120px] xs:w-[130px] sm:w-[155px] max-w-[160px] flex-shrink-0 snap-start">
                  <MedicineCard medicine={med} compact />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacer for sticky button */}
        <div className="h-16 xs:h-20" />
      </div>

      {/* Sticky bottom button */}
      <div className="fixed bottom-14 xs:bottom-16 left-0 right-0 z-30 px-1.5 xs:px-3 sm:px-4 pb-1.5 xs:pb-3">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => router.push("/cart/pharmacy")}
            className="stitch-button w-full py-3 xs:py-4 text-sm xs:text-base font-bold rounded-2xl shadow-glass"
            disabled={cartItems.length === 0}
          >
            Выбрать аптеку
          </button>
        </div>
      </div>
    </AppShell>
  );
}
