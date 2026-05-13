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
import { MedicineCardSkeleton } from "@/widgets/catalog/MedicineCardSkeleton";
import { Button, IconButton, Icon, EmptyState } from "@/shared/ui";

export default function CartPage() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { basket, loadBasket, removeItem, setQuantity, clearAll, isLoading, error } = useCartStore((state) => state);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

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

  const itemsLabel = totalUnits === 1
    ? "товар"
    : totalUnits < 5
      ? "товара"
      : "товаров";

  const recommendationsLoaded = useRef(false);
  // Tri-state: null = pending (categories not resolved yet OR cart
  // empty), true = loading the rail, false = done. Skeletons render
  // for both null and true so the section reserves its space the
  // moment the user lands on /cart instead of popping in 300 ms later.
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(true);
  useEffect(() => {
    if (recommendationsLoaded.current) return;
    const cartMedicineIds = new Set(cartItems.map((i) => i.medicineId));
    const categories = new Set<string>();
    for (const item of cartItems) {
      const m = medicineMap[item.medicineId];
      if (m?.categoryId) categories.add(m.categoryId);
    }
    // Wait for medicineMap to hydrate — until we know at least one
    // cart item's category we can't fetch recommendations.
    if (cartItems.length > 0 && categories.size === 0) return;
    if (cartItems.length === 0) {
      // Empty cart — there's nothing to recommend FROM. Drop skeletons.
      setIsLoadingRecommendations(false);
      return;
    }
    recommendationsLoaded.current = true;
    const catId = [...categories][0];
    getCatalogMedicinesPaginated(1, 12, catId)
      .then((data) => {
        const meds = (data?.medicines ?? []).filter((m: ApiMedicine) => !cartMedicineIds.has(m.id));
        setRecommendations(meds.slice(0, 10));
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingRecommendations(false));
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

  // Atomic clear — used by the trash-bin button after the user confirms.
  // Both the guest store's `clear()` and `clearAll(token)` empty all
  // positions in a single state update, so the row-by-row fade-out the user
  // saw before is gone — the cart goes from N items → empty in one frame.
  const clearGuest = useGuestCartStore((s) => s.clear);
  const performClear = useCallback(async () => {
    setClearing(true);
    try {
      if (isGuest) clearGuest();
      else if (token) await clearAll(token);
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  }, [isGuest, token, clearGuest, clearAll]);

  const onCheckout = useCallback(() => {
    router.push("/cart/pharmacy");
  }, [router]);

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
      {showClearConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !clearing && setShowClearConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-surface-container-lowest p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold">Очистить корзину?</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Все товары в корзине будут удалены. Действие нельзя отменить.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                size="md"
                variant="secondary"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
              >
                Отмена
              </Button>
              <Button
                size="md"
                variant="danger"
                loading={clearing}
                onClick={performClear}
              >
                Да, очистить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
      ) : null}

      {/* Two-column shell on lg+ : positions on the left, receipt on
          the right. Below lg the right column hides; the receipt
          reappears as a fixed-to-viewport bar at the bottom of the
          page (see <MobileReceipt /> below). lg:items-start lets the
          right column stick at the top instead of growing to match
          the positions list. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {/* Header row: count summary + clear-cart icon. The total
              price moves out of here — it now lives in the receipt
              block on desktop and in the pinned bottom bar on mobile,
              so it's never duplicated in the user's eye-line. */}
          <div className="mb-3 flex items-center justify-between gap-2 xs:mb-4">
            <p className="font-display text-lg font-extrabold text-on-surface xs:text-xl">
              В корзине: {totalUnits} {itemsLabel}
            </p>
            <IconButton
              icon="trash"
              variant="danger"
              size="md"
              onClick={() => setShowClearConfirm(true)}
              aria-label="Очистить корзину"
            />
          </div>

          {/* Items list */}
          <ul className="space-y-2">
            {cartItems.map((item) => {
              const medicine = medicineMap[item.medicineId];
              const image = resolveMedicineImageUrl(medicine, 240);
              const name = medicine ? getMedicineDisplayName(medicine) : `Загрузка...`;
              const minPrice = getCheapestPrice(medicine);

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
                    className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-image-backdrop xs:h-12 xs:w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 md:rounded-2xl"
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

                  {/* Name + per-unit "от X TJS" right under it. The small inline
                      hint hides at lg+ — that breakpoint promotes the price into
                      its own bigger column inside the right cluster, sitting at
                      the same vertical level as the title and the stepper. */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${item.medicineId}`}
                      className="line-clamp-2 text-[11px] font-bold leading-tight text-on-surface transition hover:text-primary xs:text-[12px] sm:text-[13px] md:text-sm"
                    >
                      {name}
                    </Link>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant xs:text-[11px] sm:text-xs lg:hidden">
                      от{" "}
                      <span className="font-bold text-primary tabular-nums">
                        {minPrice ? formatMoney(minPrice) : "—"}
                      </span>
                    </p>
                  </div>

                  {/* Right cluster — at lg+ now houses a prominent per-unit price
                      column to the LEFT of the stepper so all three (name,
                      price, stepper) align on the same horizontal line. */}
                  <div className="flex flex-shrink-0 items-center gap-2.5 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                    {/* Big per-unit price — desktop only. Bumped to a heavier
                        weight + bigger size than the inline mobile hint so it
                        reads as the row's primary number alongside the stepper. */}
                    <p className="hidden whitespace-nowrap text-base font-bold text-on-surface-variant tabular-nums lg:block">
                      от{" "}
                      <span className="font-extrabold text-primary">
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
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Desktop receipt — sticky in the right column so it follows
            the page as the list scrolls. `top-24` clears the global
            top bar. Hidden below lg (the mobile bar covers <lg). */}
        <aside className="mt-6 hidden lg:sticky lg:top-24 lg:mt-0 lg:block">
          <div className="rounded-3xl bg-surface-container-lowest p-5 shadow-card">
            <p className="font-display text-base font-extrabold uppercase tracking-wider text-on-surface-variant">
              Итого
            </p>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-on-surface-variant">Товаров</dt>
                <dd className="font-semibold tabular-nums">{totalUnits} {itemsLabel}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-on-surface-variant">Стоимость</dt>
                <dd className="font-semibold tabular-nums">от {formatMoney(cartMinTotal)}</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-surface-container-high pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold">К оплате</span>
                <span className="font-display text-xl font-extrabold text-primary tabular-nums">
                  от {formatMoney(cartMinTotal)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              fullWidth
              rightIcon="arrow-right"
              onClick={onCheckout}
              disabled={cartItems.length === 0}
              className="mt-5"
            >
              Выбрать аптеку
            </Button>

            <p className="mt-3 text-[11px] leading-snug text-on-surface-variant">
              На следующем шаге выберете аптеку — цена может измениться в зависимости от наличия позиций.
            </p>
          </div>
        </aside>
      </div>

      {/* Recommendations — sits below BOTH columns on desktop, between
          positions and the pinned bottom bar on mobile. Skeletons hold
          the row height while the rail loads so the layout doesn't
          jump as recommendations stream in. */}
      {(isLoadingRecommendations || recommendations.length > 0) && (
        <section className="mt-6 mb-4 space-y-2 xs:mt-8 xs:space-y-3">
          <h3 className="font-display text-base font-extrabold xs:text-lg">Добавьте к заказу</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scroll-touch scrollbar-hide snap-x">
            {isLoadingRecommendations
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-[130px] flex-shrink-0 snap-start xs:w-[140px]">
                    <MedicineCardSkeleton compact />
                  </div>
                ))
              : recommendations.map((med) => (
                  <div key={med.id} className="w-[130px] flex-shrink-0 snap-start xs:w-[140px]">
                    <MedicineCard medicine={med} compact />
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Spacer for the fixed bottom bar on mobile so the last
          recommendation row isn't covered. Sized to match the bar's
          rough height (≈ 84 px of content + safe-area inset). lg+
          has no bar, so no spacer needed. */}
      <div aria-hidden className="h-28 lg:hidden" />

      {/* Mobile pinned receipt — fixed to the viewport bottom, lifted
          above the iOS home indicator via pb-safe-4. backdrop-blur
          softens the recommendation cards visible behind it. Uses
          z-30 (under the clear-confirm modal at z-50 and the global
          BottomNav at z-40 — irrelevant here because BottomNav only
          shows for admin/pharmacist roles, never for /cart clients). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-container-high bg-surface-container-lowest/95 backdrop-blur-md pb-safe-4 lg:hidden">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-on-surface-variant xs:text-xs">
              {totalUnits} {itemsLabel}
            </p>
            <p className="font-display text-lg font-extrabold tabular-nums xs:text-xl">
              от {formatMoney(cartMinTotal)}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            rightIcon="arrow-right"
            onClick={onCheckout}
            disabled={cartItems.length === 0}
          >
            <span className="xs:hidden">Оформить</span>
            <span className="hidden xs:inline">Выбрать аптеку</span>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
