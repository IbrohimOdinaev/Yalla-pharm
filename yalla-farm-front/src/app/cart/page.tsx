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
import {
  computeBestPriceFromOffers,
  computeBestPriceFromPharmacyOptions,
} from "@/features/cart/model/bestPharmacyPrice";
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

  const bestPrice = useMemo(() => {
    if (!isGuest) {
      const fromServer = computeBestPriceFromPharmacyOptions(
        basket.pharmacyOptions,
        cartItems.length,
      );
      if (fromServer) return fromServer;
    }
    return computeBestPriceFromOffers(cartItems, medicineMap);
  }, [isGuest, basket.pharmacyOptions, cartItems, medicineMap]);

  const cartMinTotal = useMemo(() => {
    if (bestPrice) return bestPrice.price;
    return cartItems.reduce((sum, item) => {
      const price = getCheapestPrice(medicineMap[item.medicineId]) ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [bestPrice, cartItems, medicineMap]);

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
      <div className="mb-3 flex items-center justify-between gap-2 xs:mb-4">
        <div className="min-w-0">
          <p className="text-[11px] text-on-surface-variant xs:text-xs">
            {totalUnits} {totalUnits === 1 ? "товар" : totalUnits < 5 ? "товара" : "товаров"}
          </p>
          <p className="font-display text-lg font-extrabold text-on-surface xs:text-xl">
            от {formatMoney(cartMinTotal)}
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
          const image = resolveMedicineImageUrl(medicine, 120);
          const name = medicine ? getMedicineDisplayName(medicine) : `Загрузка...`;
          const minPrice = getCheapestPrice(medicine);

          const lineTotal = (minPrice ?? 0) * item.quantity;
          return (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:gap-3 xs:p-3.5 sm:gap-4 sm:p-4 md:gap-6 md:p-5 lg:gap-6"
            >
              {/* Delete X — leftmost only at lg+. Below 1024px the X moves
                  into the qty-stepper cluster (rendered inline below) so the
                  row stays tight and the X+stepper read as one block. */}
              <button
                type="button"
                onClick={() => onRemove(item.id, item.medicineId)}
                className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/70 transition hover:bg-secondary-soft hover:text-secondary active:scale-95 lg:flex"
                aria-label="Удалить"
              >
                <Icon name="close" size={14} />
              </button>

              {/* Image — shrinks one step at md- so the whole row fits the
                  smaller font scale. */}
              <Link
                href={`/product/${item.medicineId}`}
                className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container xs:h-12 xs:w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 md:rounded-2xl"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={name} className="h-full w-full object-contain mix-blend-multiply" />
                ) : (
                  <div className="flex h-full items-center justify-center text-on-surface-variant/40">
                    <Icon name="bag" size={20} />
                  </div>
                )}
              </Link>

              {/* Name + "от X TJS" hint underneath. The min-price stays
                  stacked under the name everywhere except lg+, where it
                  pops out into its own column inside the right cluster
                  (matches the desktop reference). */}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.medicineId}`}
                  className="line-clamp-2 text-[11px] font-bold leading-tight text-on-surface transition hover:text-primary xs:text-[12px] sm:text-[13px] md:text-sm"
                >
                  {name}
                </Link>
                <p className="mt-0.5 text-[10px] text-on-surface-variant xs:text-[11px] sm:text-xs lg:hidden">
                  от{" "}
                  <span className="font-bold text-primary">
                    {minPrice ? formatMoney(minPrice) : "—"}
                  </span>
                </p>
              </div>

              {/* Right cluster — the inner gap matches the outer flex gap
                  below lg so the visible spacing is uniform across name →
                  stepper → total (3 evenly-spaced blocks the user asked
                  for). At lg+ the cluster grows its own ~3× gap and a
                  separate "от X TJS" column slots in front of the stepper
                  (desktop reference). */}
              <div className="flex flex-shrink-0 items-center gap-2.5 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-24">
                {/* Min price column — only visible at lg+; below lg the same
                    info is rendered as a small line under the product name. */}
                <p className="hidden text-sm text-on-surface-variant lg:block">
                  от{" "}
                  <span className="font-bold text-on-surface tabular-nums">
                    {minPrice ? formatMoney(minPrice) : "—"}
                  </span>
                </p>

                {/* Stepper cluster — at <lg the X-button stacks BELOW the
                    stepper inside this same flex column, vertically centred
                    so the gap between them sits on the row's mid-line. At
                    lg+ this collapses to just the stepper (the X lives back
                    on the left). */}
                <div className="flex flex-col items-center justify-center gap-2 lg:flex-row lg:gap-0">
                  <div className="flex items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.id, item.medicineId, item.quantity)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-40 md:h-8 md:w-8"
                      aria-label="Уменьшить"
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <span className="min-w-[1.25rem] text-center text-xs font-extrabold tabular-nums md:min-w-[1.5rem] md:text-sm">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.id, item.medicineId, item.quantity)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95 disabled:opacity-40 md:h-8 md:w-8"
                      aria-label="Увеличить"
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id, item.medicineId)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant/70 transition hover:bg-secondary-soft hover:text-secondary active:scale-95 lg:hidden"
                    aria-label="Удалить"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>

                {/* Line total — minPrice × quantity in primary text colour
                    so it reads as a hard number, not an alert. min-w keeps
                    the column stable so the value doesn't jiggle while the
                    user steps the qty. Type bumps a step at md to match the
                    rest of the row's scaled-up sizing above 745px. */}
                <span className="min-w-[60px] text-right font-display text-xs font-extrabold tabular-nums text-on-surface xs:min-w-[68px] xs:text-[13px] sm:min-w-[80px] sm:text-sm md:min-w-[96px] md:text-base">
                  {minPrice ? formatMoney(lineTotal) : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Inline CTA — placed directly under the cart list so the primary
          action stays in the user's eye-line; the upsell rail follows below. */}
      <div className="mt-6 xs:mt-8">
        <div className="mx-auto max-w-3xl">
          <Button
            type="button"
            size="lg"
            fullWidth
            rightIcon="arrow-right"
            onClick={() => router.push("/cart/pharmacy")}
            disabled={cartItems.length === 0}
          >
            <span className="xs:hidden">Выбрать · от {formatMoney(cartMinTotal)}</span>
            <span className="hidden xs:inline">Выбрать аптеку · от {formatMoney(cartMinTotal)}</span>
          </Button>
        </div>
      </div>

      {/* Recommendations — horizontal rail. Cards stay the same size (compact)
          so two fit visibly on a 360px screen. */}
      {recommendations.length > 0 && (
        <section className="mt-6 mb-4 space-y-2 xs:mt-8 xs:space-y-3">
          <h3 className="font-display text-base font-extrabold xs:text-lg">Добавьте к заказу</h3>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 scroll-touch scrollbar-hide snap-x xs:-mx-4 xs:px-4">
            {recommendations.map((med) => (
              <div key={med.id} className="w-[130px] flex-shrink-0 snap-start xs:w-[140px]">
                <MedicineCard medicine={med} compact />
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
