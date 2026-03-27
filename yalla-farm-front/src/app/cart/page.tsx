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
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";

const PENDING_KEY = "yalla.front.pending.payment.intent";

type PharmacyOption = {
  pharmacyId: string;
  pharmacyTitle: string;
  pharmacyAddress: string;
  totalCost: number;
  availableCount: number;
  totalCount: number;
  /** medicine IDs available in full quantity at this pharmacy */
  availableMedicineIds: Set<string>;
};

export default function CartPage() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { basket, loadBasket, removeItem, setQuantity, isLoading, error } = useCartStore((state) => state);
  const { pharmacyId: selectedPharmacyId, deliveryAddress, isPickup, setDraft } = useCheckoutDraftStore((state) => state);

  const savedDeliveryAddress = useDeliveryAddressStore((s) => s.address);
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);

  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressValid, setIsAddressValid] = useState(true);

  useBasketLive();

  const isGuest = !token;

  const guestItems = useGuestCartStore((s) => s.items);
  const loadGuestCart = useGuestCartStore((s) => s.load);
  const removeGuestItem = useGuestCartStore((s) => s.removeItem);
  const setGuestQuantity = useGuestCartStore((s) => s.setQuantity);

  useEffect(() => { loadDeliveryAddress(); }, [loadDeliveryAddress]);

  useEffect(() => {
    if (!token) { loadGuestCart(); return; }
    loadBasket(token).catch(() => undefined);
  }, [token, loadBasket, loadGuestCart]);

  // Set saved address as default if checkout draft is empty
  useEffect(() => {
    if (!deliveryAddress && savedDeliveryAddress) {
      setDraft({ deliveryAddress: savedDeliveryAddress });
    }
  }, [savedDeliveryAddress, deliveryAddress, setDraft]);

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

  // Unified cart items
  const cartItems = isGuest
    ? guestItems.map((item) => ({ id: item.medicineId, medicineId: item.medicineId, quantity: item.quantity }))
    : (basket.positions ?? []).map((p) => ({ id: p.id, medicineId: p.medicineId, quantity: p.quantity }));

  // ── Build pharmacy options with per-item availability ──
  const options = useMemo((): PharmacyOption[] => {
    if (cartItems.length === 0 || Object.keys(medicineMap).length === 0) return [];

    const pharmacyMap = new Map<string, {
      pharmacyId: string; pharmacyTitle: string; pharmacyAddress: string;
      totalCost: number; availableMedicineIds: Set<string>;
    }>();

    for (const item of cartItems) {
      const medicine = medicineMap[item.medicineId];
      if (!medicine?.offers) continue;
      for (const offer of medicine.offers) {
        if (offer.price <= 0) continue;
        if (offer.stockQuantity < item.quantity) continue; // not enough stock
        const entry = pharmacyMap.get(offer.pharmacyId) ?? {
          pharmacyId: offer.pharmacyId,
          pharmacyTitle: offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8),
          pharmacyAddress: "",
          totalCost: 0,
          availableMedicineIds: new Set<string>(),
        };
        entry.availableMedicineIds.add(item.medicineId);
        entry.totalCost += offer.price * item.quantity;
        pharmacyMap.set(offer.pharmacyId, entry);
      }
    }

    const total = cartItems.length;
    return Array.from(pharmacyMap.values())
      .filter((p) => p.availableMedicineIds.size > 0)
      .map((p) => ({
        pharmacyId: p.pharmacyId,
        pharmacyTitle: p.pharmacyTitle,
        pharmacyAddress: p.pharmacyAddress,
        totalCost: p.totalCost,
        availableCount: p.availableMedicineIds.size,
        totalCount: total,
        availableMedicineIds: p.availableMedicineIds,
      }))
      .sort((a, b) => b.availableCount - a.availableCount || a.totalCost - b.totalCost);
  }, [cartItems, medicineMap]);

  // Auto-select best pharmacy (most items available)
  useEffect(() => {
    if (selectedPharmacyId && options.some((o) => o.pharmacyId === selectedPharmacyId)) return;
    const best = options[0]; // sorted: most items first
    if (best) setDraft({ pharmacyId: best.pharmacyId });
  }, [options, selectedPharmacyId, setDraft]);

  const selectedOption = useMemo(() => {
    return options.find((o) => o.pharmacyId === selectedPharmacyId);
  }, [options, selectedPharmacyId]);

  // Items that WILL be ordered from selected pharmacy
  const includedItems = useMemo(() => {
    if (!selectedOption) return [];
    return cartItems.filter((item) => selectedOption.availableMedicineIds.has(item.medicineId));
  }, [cartItems, selectedOption]);

  // Items that will NOT be ordered (stay in cart)
  const excludedItems = useMemo(() => {
    if (!selectedOption) return cartItems;
    return cartItems.filter((item) => !selectedOption.availableMedicineIds.has(item.medicineId));
  }, [cartItems, selectedOption]);

  // Position IDs to ignore in backend checkout (server basket positions not available at selected pharmacy)
  const ignoredPositionIds = useMemo(() => {
    if (isGuest || !selectedOption) return [];
    return (basket.positions ?? [])
      .filter((p) => !selectedOption.availableMedicineIds.has(p.medicineId))
      .map((p) => p.id);
  }, [isGuest, basket.positions, selectedOption]);

  // Cost of items being ordered
  const checkoutCost = useMemo(() => {
    return includedItems.reduce((sum, item) => {
      const medicine = medicineMap[item.medicineId];
      if (!medicine?.offers) return sum;
      const offer = medicine.offers.find((o) =>
        o.pharmacyId === selectedPharmacyId && o.stockQuantity >= item.quantity && o.price > 0
      );
      return sum + (offer ? offer.price * item.quantity : 0);
    }, 0);
  }, [includedItems, medicineMap, selectedPharmacyId]);

  const cartTotalCost = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = getCheapestPrice(medicineMap[item.medicineId]) ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cartItems, medicineMap]);

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
          localStorage.removeItem(PENDING_KEY);
        }
      } catch { /* ignore */ }
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      if (!selectedPharmacyId) throw new Error("Выберите аптеку перед оформлением.");
      if (includedItems.length === 0) throw new Error("В выбранной аптеке нет доступных товаров.");

      const idempotencyKey = buildCheckoutIdempotencyKey();
      const payload = {
        pharmacyId: selectedPharmacyId,
        isPickup,
        deliveryAddress,
        idempotencyKey,
        ignoredPositionIds,
      };

      await apiFetch("/api/clients/checkout/preview", { method: "POST", token, body: payload });

      const checkout = await apiFetch<ApiCheckoutResponse>("/api/clients/checkout", {
        method: "POST", token, body: payload,
      });

      const paymentUrl = String(checkout.paymentUrl || "").trim();
      const pending = {
        paymentIntentId: String(checkout.paymentIntentId || ""),
        reservedOrderId: String(checkout.reservedOrderId || checkout.orderId || ""),
        paymentUrl,
        amount: Number(checkout.cost || checkout.amount || 0),
        currency: String(checkout.currency || "TJS"),
        paymentExpiresAtUtc: checkout.paymentExpiresAtUtc ?? null,
      };
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

      // For guest: remove only ordered items from guest cart
      if (isGuest) {
        for (const item of includedItems) removeGuestItem(item.medicineId);
      }

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

        {/* Cart items */}
        {cartItems.map((item) => {
          const medicine = medicineMap[item.medicineId];
          const image = resolveMedicineImageUrl(medicine);
          const name = medicine ? getMedicineDisplayName(medicine) : `Товар ${item.medicineId.slice(0, 8)}`;
          const unitPrice = getCheapestPrice(medicine) ?? 0;
          const lineCost = unitPrice * item.quantity;
          const isExcluded = selectedOption ? !selectedOption.availableMedicineIds.has(item.medicineId) : false;

          return (
            <article key={item.id} className={`stitch-card flex gap-4 p-4 transition ${isExcluded ? "opacity-40" : ""}`}>
              <Link href={`/product/${item.medicineId}`} className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-on-surface-variant">Нет фото</div>
                )}
              </Link>
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/product/${item.medicineId}`} className="font-bold hover:text-primary transition">{name}</Link>
                  {isExcluded ? (
                    <span className="flex-shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">Нет в аптеке</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-on-surface-variant">{formatMoney(unitPrice)} × {item.quantity}</span>
                  <span className="font-bold text-primary">{formatMoney(lineCost)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="stitch-button-secondary px-3 py-2"
                    onClick={() => { if (isGuest) setGuestQuantity(item.medicineId, Math.max(1, item.quantity - 1)); else if (token) setQuantity(token, item.id, Math.max(1, item.quantity - 1)).catch(() => undefined); }}
                    disabled={!isGuest && isLoading}>&#8722;</button>
                  <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                  <button type="button" className="stitch-button-secondary px-3 py-2"
                    onClick={() => { if (isGuest) setGuestQuantity(item.medicineId, item.quantity + 1); else if (token) setQuantity(token, item.id, item.quantity + 1).catch(() => undefined); }}
                    disabled={!isGuest && isLoading}>+</button>
                  <button type="button" className="ml-auto rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700"
                    onClick={() => { if (isGuest) removeGuestItem(item.medicineId); else if (token) removeItem(token, item.id).catch(() => undefined); }}
                    disabled={!isGuest && isLoading}>Удалить</button>
                </div>
              </div>
            </article>
          );
        })}

        {/* Summary */}
        <section className="stitch-card space-y-3 p-5">
          <h3 className="text-lg font-bold">Итого в корзине</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">Всего товаров</span>
            <span className="font-semibold">{cartItems.length} · {formatMoney(cartTotalCost)}</span>
          </div>
          {selectedOption && excludedItems.length > 0 ? (
            <div className="flex items-center justify-between text-sm text-yellow-700">
              <span>Не войдёт в заказ</span>
              <span className="font-semibold">{excludedItems.length} товаров (останутся в корзине)</span>
            </div>
          ) : null}
          {selectedOption ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant font-bold">К оформлению</span>
              <span className="font-extrabold text-primary">{includedItems.length} · {formatMoney(checkoutCost)}</span>
            </div>
          ) : null}
        </section>

        {/* Pharmacy selection */}
        {options.length > 0 ? (
          <section className="stitch-card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Выбор аптеки</h3>
              <span className="text-xs text-on-surface-variant">{options.length} аптек</span>
            </div>
            {options.map((option) => {
              const isSelected = selectedPharmacyId === option.pharmacyId;
              const allAvailable = option.availableCount === option.totalCount;
              return (
                <div key={option.pharmacyId}
                  className={`rounded-2xl p-4 space-y-2 cursor-pointer transition ${isSelected ? "bg-primary/5 ring-2 ring-primary" : "bg-surface-container-low hover:bg-surface-container-high"}`}
                  onClick={() => setDraft({ pharmacyId: option.pharmacyId })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{option.pharmacyTitle}</p>
                      {option.pharmacyAddress ? <p className="text-xs text-on-surface-variant">{option.pharmacyAddress}</p> : null}
                    </div>
                    <p className="text-lg font-black text-primary">{formatMoney(option.totalCost)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${allAvailable ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {option.availableCount}/{option.totalCount} в наличии
                    </span>
                    {isSelected ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">Выбрано</span> : null}
                  </div>
                </div>
              );
            })}
          </section>
        ) : cartItems.length > 0 ? (
          <div className="stitch-card p-5 text-sm text-on-surface-variant text-center">
            Ни одна аптека не имеет товары из вашей корзины в нужном количестве.
          </div>
        ) : null}

        {/* Checkout panel */}
        <section className="stitch-card space-y-4 p-5">
          <h3 className="text-lg font-bold">Оформление заказа</h3>

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
            <AddressAutocomplete
              value={deliveryAddress}
              onChange={(v) => setDraft({ deliveryAddress: v })}
              onValidChange={setIsAddressValid}
              placeholder="Адрес доставки"
            />
          )}

          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">К оплате:</span>
            <span className="text-xl font-black text-primary">{formatMoney(checkoutCost)}</span>
          </div>

          {excludedItems.length > 0 && selectedOption ? (
            <p className="text-xs text-yellow-700 text-center">
              {excludedItems.length} товаров нет в {selectedOption.pharmacyTitle} — они останутся в корзине
            </p>
          ) : null}

          {isGuest ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-on-surface-variant text-center">Для оформления заказа необходимо войти в аккаунт. Корзина сохранится.</p>
              <div className="flex gap-3">
                <Link href="/login" className="stitch-button flex-1 text-center">Войти и оформить</Link>
                <Link href="/register" className="stitch-button-secondary flex-1 text-center">Регистрация</Link>
              </div>
            </div>
          ) : (
            <button type="button" className="stitch-button w-full py-4 text-base" onClick={onCheckout}
              disabled={isSubmitting || includedItems.length === 0 || (!isPickup && !isAddressValid)}>
              {isSubmitting ? "Оформляем..." : includedItems.length === 0 ? "Нет товаров для оформления" : !isPickup && !isAddressValid ? "Укажите корректный адрес" : `Оформить заказ (${includedItems.length} товаров)`}
            </button>
          )}
        </section>
      </div>
    </AppShell>
  );
}
