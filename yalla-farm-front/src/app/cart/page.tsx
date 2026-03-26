"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl, getCheapestPrice } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { buildCheckoutIdempotencyKey } from "@/shared/lib/idempotency";
import { apiFetch } from "@/shared/api/http-client";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { useBasketLive } from "@/features/cart/model/useBasketLive";
import type { ApiCheckoutResponse } from "@/shared/types/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

const PENDING_KEY = "yalla.front.pending.payment.intent";

export default function CartPage() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { basket, loadBasket, removeItem, setQuantity, isLoading, error } = useCartStore((state) => state);
  const { pharmacyId: selectedPharmacyId, deliveryAddress, isPickup, setDraft } = useCheckoutDraftStore((state) => state);

  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBasketLive();

  const isGuest = !token;

  const guestItems = useGuestCartStore((s) => s.items);
  const loadGuestCart = useGuestCartStore((s) => s.load);
  const removeGuestItem = useGuestCartStore((s) => s.removeItem);
  const setGuestQuantity = useGuestCartStore((s) => s.setQuantity);

  useEffect(() => {
    if (!token) {
      loadGuestCart();
      return;
    }
    loadBasket(token).catch(() => undefined);
  }, [token, loadBasket, loadGuestCart]);

  useEffect(() => {
    const serverIds = (basket.positions ?? []).map((item) => item.medicineId);
    const guestIds = isGuest ? guestItems.map((item) => item.medicineId) : [];
    const ids = [...new Set([...serverIds, ...guestIds])];
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
  }, [basket.positions, guestItems, isGuest]);

  // Unified cart items for both guest and authenticated
  const cartItems = isGuest
    ? guestItems.map((item) => ({
        id: item.medicineId,
        medicineId: item.medicineId,
        quantity: item.quantity,
      }))
    : (basket.positions ?? []).map((p) => ({
        id: p.id,
        medicineId: p.medicineId,
        quantity: p.quantity,
      }));

  // Build pharmacy options: from API for authenticated, computed from offers for guest
  const options = useMemo(() => {
    // Use server pharmacy options if available (authenticated user)
    if (!isGuest && (basket.pharmacyOptions ?? []).length > 0) {
      return (basket.pharmacyOptions ?? []).filter((o) => (o.enoughQuantityMedicinesCount ?? 0) > 0);
    }

    // Compute from medicine offers for guest
    if (cartItems.length === 0 || Object.keys(medicineMap).length === 0) return [];

    const pharmacyMap = new Map<string, {
      pharmacyId: string; pharmacyTitle: string; pharmacyAddress: string;
      totalCost: number; foundCount: number; enoughCount: number;
    }>();

    for (const item of cartItems) {
      const medicine = medicineMap[item.medicineId];
      if (!medicine?.offers) continue;
      for (const offer of medicine.offers) {
        if (offer.price <= 0) continue;
        const entry = pharmacyMap.get(offer.pharmacyId) ?? {
          pharmacyId: offer.pharmacyId,
          pharmacyTitle: offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8),
          pharmacyAddress: "",
          totalCost: 0, foundCount: 0, enoughCount: 0,
        };
        entry.foundCount += 1;
        entry.totalCost += offer.price * item.quantity;
        if (offer.stockQuantity >= item.quantity) entry.enoughCount += 1;
        pharmacyMap.set(offer.pharmacyId, entry);
      }
    }

    const total = cartItems.length;
    return Array.from(pharmacyMap.values())
      .filter((p) => p.enoughCount > 0) // only pharmacies with at least 1 item in full quantity
      .map((p) => ({
        pharmacyId: p.pharmacyId,
        pharmacyTitle: p.pharmacyTitle,
        pharmacyAddress: p.pharmacyAddress,
        totalCost: p.totalCost,
        foundMedicinesCount: p.foundCount,
        totalMedicinesCount: total,
        enoughQuantityMedicinesCount: p.enoughCount,
        isAvailable: p.foundCount === total && p.enoughCount === total,
      }))
      .sort((a, b) => (a.totalCost ?? 0) - (b.totalCost ?? 0));
  }, [isGuest, basket.pharmacyOptions, cartItems, medicineMap]);

  // Auto-select first available pharmacy
  useEffect(() => {
    if (selectedPharmacyId) return;
    const firstOption = options.find((o) => o.isAvailable) ?? options[0];
    if (firstOption?.pharmacyId) {
      setDraft({ pharmacyId: String(firstOption.pharmacyId) });
    }
  }, [options, selectedPharmacyId, setDraft]);

  const selectedOption = useMemo(() => {
    return options.find((o) => String(o.pharmacyId) === String(selectedPharmacyId));
  }, [options, selectedPharmacyId]);

  async function onCheckout() {
    if (isGuest) {
      localStorage.setItem("yalla.guest.checkout.intent.v1", "1");
      router.push("/login");
      return;
    }
    if (!token) return;

    // Check for existing pending payment
    const existingPending = localStorage.getItem(PENDING_KEY);
    if (existingPending) {
      try {
        const parsed = JSON.parse(existingPending);
        if (parsed.paymentUrl) {
          if (confirm("У вас есть неоплаченный заказ. Перейти к оплате?")) {
            window.location.assign(parsed.paymentUrl);
            return;
          }
          // User declined — remove old pending and proceed with new checkout
          localStorage.removeItem(PENDING_KEY);
        }
      } catch { /* ignore */ }
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      if (!selectedPharmacyId) {
        throw new Error("Выберите аптеку перед оформлением.");
      }

      const idempotencyKey = buildCheckoutIdempotencyKey();
      const payload = {
        pharmacyId: selectedPharmacyId,
        isPickup,
        deliveryAddress,
        idempotencyKey,
        ignoredPositionIds: []
      };

      await apiFetch("/api/clients/checkout/preview", {
        method: "POST",
        token,
        body: payload
      });

      const checkout = await apiFetch<ApiCheckoutResponse>("/api/clients/checkout", {
        method: "POST",
        token,
        body: payload
      });

      const paymentUrl = String(checkout.paymentUrl || "").trim();
      const pending = {
        paymentIntentId: String(checkout.paymentIntentId || ""),
        reservedOrderId: String(checkout.reservedOrderId || checkout.orderId || ""),
        paymentUrl,
        amount: Number(checkout.cost || checkout.amount || 0),
        currency: String(checkout.currency || "TJS"),
        paymentExpiresAtUtc: checkout.paymentExpiresAtUtc ?? null
      };

      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

      // Redirect to external payment page (DushanbeCity) like old frontend
      if (paymentUrl) {
        window.location.assign(paymentUrl);
      } else {
        router.push("/payment-await");
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Не удалось оформить заказ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const cartTotalCost = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const medicine = medicineMap[item.medicineId];
      const price = getCheapestPrice(medicine) ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cartItems, medicineMap]);

  if (cartItems.length === 0 && !isLoading) {
    return (
      <AppShell top={<TopBar title="Корзина" backHref="/" />}>
        <div className="stitch-card p-6 text-sm">Корзина пустая. Добавьте товары из каталога.</div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Корзина" backHref="/" />}>
      <div className="space-y-4">
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
        {checkoutError ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{checkoutError}</div> : null}

        {/* Cart items — same UI for guest and authenticated */}
        {cartItems.map((item) => {
          const medicine = medicineMap[item.medicineId];
          const image = resolveMedicineImageUrl(medicine);
          const name = medicine ? getMedicineDisplayName(medicine) : `Товар ${item.medicineId.slice(0, 8)}`;
          const unitPrice = getCheapestPrice(medicine) ?? 0;
          const lineCost = unitPrice * item.quantity;

          return (
            <article key={item.id} className="stitch-card flex gap-4 p-4">
              <Link href={`/product/${item.medicineId}`} className="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-on-surface-variant">Нет фото</div>
                )}
              </Link>
              <div className="flex-1 space-y-2">
                <Link href={`/product/${item.medicineId}`} className="font-bold hover:text-primary transition">{name}</Link>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-on-surface-variant">{formatMoney(unitPrice)} × {item.quantity}</span>
                  <span className="font-bold text-primary">{formatMoney(lineCost)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="stitch-button-secondary px-3 py-2"
                    onClick={() => {
                      if (isGuest) setGuestQuantity(item.medicineId, Math.max(1, item.quantity - 1));
                      else if (token) setQuantity(token, item.id, Math.max(1, item.quantity - 1)).catch(() => undefined);
                    }}
                    disabled={!isGuest && isLoading}
                  >&#8722;</button>
                  <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    className="stitch-button-secondary px-3 py-2"
                    onClick={() => {
                      if (isGuest) setGuestQuantity(item.medicineId, item.quantity + 1);
                      else if (token) setQuantity(token, item.id, item.quantity + 1).catch(() => undefined);
                    }}
                    disabled={!isGuest && isLoading}
                  >+</button>
                  <button
                    type="button"
                    className="ml-auto rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700"
                    onClick={() => {
                      if (isGuest) removeGuestItem(item.medicineId);
                      else if (token) removeItem(token, item.id).catch(() => undefined);
                    }}
                    disabled={!isGuest && isLoading}
                  >Удалить</button>
                </div>
              </div>
            </article>
          );
        })}

        {/* Summary */}
        <section className="stitch-card space-y-3 p-5">
          <h3 className="text-lg font-bold">Итого</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">Сумма товаров</span>
            <span className="font-semibold">{formatMoney(cartTotalCost)}</span>
          </div>
        </section>

        {/* Pharmacy selection — shown for authenticated users with basket data */}
        {options.length > 0 && (
          <section className="stitch-card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Выбор аптеки</h3>
              <span className="text-xs text-on-surface-variant">{options.length} аптек</span>
            </div>
            {options.map((option) => {
              const isSelected = selectedPharmacyId === String(option.pharmacyId);
              const allAvailable = option.foundMedicinesCount === option.totalMedicinesCount;
              return (
                <div
                  key={option.pharmacyId}
                  className={`rounded-2xl p-4 space-y-2 cursor-pointer transition ${isSelected ? "bg-primary/5 ring-2 ring-primary" : "bg-surface-container-low hover:bg-surface-container-high"}`}
                  onClick={() => setDraft({ pharmacyId: String(option.pharmacyId) })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{option.pharmacyTitle ?? "Аптека"}</p>
                      <p className="text-xs text-on-surface-variant">{option.pharmacyAddress ?? ""}</p>
                    </div>
                    <p className="text-lg font-black text-primary">{formatMoney(option.totalCost)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${allAvailable ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {option.foundMedicinesCount}/{option.totalMedicinesCount} найдено
                    </span>
                    {isSelected && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">Выбрано</span>}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Checkout panel */}
        <section className="stitch-card space-y-4 p-5">
          <h3 className="text-lg font-bold">Оформление заказа</h3>

          {/* Delivery mode */}
          <div className="flex gap-3">
            <button type="button" onClick={() => setDraft({ isPickup: false })}
              className={`flex-1 rounded-xl p-3 text-sm font-bold transition ${!isPickup ? "bg-primary text-white" : "bg-surface-container-low"}`}>
              Доставка
            </button>
            <button type="button" onClick={() => setDraft({ isPickup: true })}
              className={`flex-1 rounded-xl p-3 text-sm font-bold transition ${isPickup ? "bg-primary text-white" : "bg-surface-container-low"}`}>
              Самовывоз
            </button>
          </div>

          {!isPickup && (
            <input className="stitch-input w-full" placeholder="Адрес доставки" value={deliveryAddress}
              onChange={(e) => setDraft({ deliveryAddress: e.target.value })} required />
          )}

          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">К оплате:</span>
            <span className="text-xl font-black text-primary">{formatMoney(selectedOption?.totalCost ?? cartTotalCost)}</span>
          </div>

          {isGuest ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-on-surface-variant text-center">Для оформления заказа необходимо войти в аккаунт. Корзина сохранится.</p>
              <div className="flex gap-3">
                <Link href="/login" className="stitch-button flex-1 text-center">Войти и оформить</Link>
                <Link href="/register" className="stitch-button-secondary flex-1 text-center">Регистрация</Link>
              </div>
            </div>
          ) : (
            <button type="button" className="stitch-button w-full py-4 text-base" onClick={onCheckout} disabled={isSubmitting}>
              {isSubmitting ? "Оформляем..." : "Оформить заказ"}
            </button>
          )}
        </section>
      </div>
    </AppShell>
  );
}
