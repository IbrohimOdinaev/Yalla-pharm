"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { apiFetch } from "@/shared/api/http-client";
import { calculateDelivery } from "@/shared/api/delivery";
import { buildCheckoutIdempotencyKey } from "@/shared/lib/idempotency";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine, ApiCheckoutResponse } from "@/shared/types/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import type { GeoPoint } from "@/shared/lib/map";

export default function CheckoutPage() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const goBack = useGoBack();

  const { loadBasket } = useCartStore();
  const {
    pharmacyId, selectedPharmacyTitle, selectedPharmacyItems, selectedPharmacyTotalCost,
    ignoredPositionIds, isPickup, deliveryCost, deliveryDistance,
    setDraft, setDeliveryAddressData, setDeliveryCost,
  } = useCheckoutDraftStore();

  const savedAddress = useDeliveryAddressStore((s) => s.address);
  const savedCoords = useDeliveryAddressStore((s) => s.coords);

  const [localAddress, setLocalAddress] = useState(savedAddress);
  const [localCoords, setLocalCoords] = useState<GeoPoint | null>(savedCoords);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});

  // Guards
  useEffect(() => {
    if (!pharmacyId) { router.replace("/cart/pharmacy"); return; }
    if (token) loadBasket(token).catch(() => undefined);
  }, [token, pharmacyId, router, loadBasket]);

  // Use items from store (works for both auth and guest)
  const checkoutItems = selectedPharmacyItems;
  const itemsAmount = selectedPharmacyTotalCost;

  // Load medicine details
  useEffect(() => {
    const ids = checkoutItems.map((i) => i.medicineId).filter((id) => !medicineMap[id]);
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => getMedicineById(id).catch(() => null))).then((results) => {
      const map: Record<string, ApiMedicine> = { ...medicineMap };
      for (const m of results) { if (m?.id) map[m.id] = m; }
      setMedicineMap(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutItems]);

  // Calculate delivery on mount if address is available
  const doCalculateDelivery = useCallback(async (coords: GeoPoint, address: string) => {
    if (!pharmacyId || isPickup) return;
    setIsCalculating(true);
    try {
      const result = await calculateDelivery({
        pharmacyId,
        toTitle: address,
        toAddress: address,
        toLatitude: coords.lat,
        toLongitude: coords.lng,
      });
      setDeliveryCost(result.deliveryCost, result.distance);
      setDeliveryAddressData({ title: address, address, lat: coords.lat, lng: coords.lng });
    } catch {
      setDeliveryCost(null, null);
    }
    setIsCalculating(false);
  }, [pharmacyId, isPickup, setDeliveryCost, setDeliveryAddressData]);

  useEffect(() => {
    if (savedCoords && savedAddress && !isPickup && deliveryCost == null) {
      doCalculateDelivery(savedCoords, savedAddress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCoords, savedAddress, isPickup]);

  const totalAmount = itemsAmount + (isPickup ? 0 : (deliveryCost ?? 0));

  function onAddressCoordinatesChange(coords: GeoPoint | null) {
    setLocalCoords(coords);
    if (coords && localAddress) {
      doCalculateDelivery(coords, localAddress);
    } else {
      setDeliveryCost(null, null);
    }
  }

  async function onSubmit() {
    if (!pharmacyId) return;
    if (!token) {
      router.push("/login?redirect=/checkout");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const idempotencyKey = buildCheckoutIdempotencyKey();
      const payload = {
        pharmacyId,
        isPickup,
        deliveryAddress: localAddress || savedAddress,
        deliveryAddressTitle: localAddress || savedAddress,
        deliveryLatitude: localCoords?.lat ?? savedCoords?.lat ?? null,
        deliveryLongitude: localCoords?.lng ?? savedCoords?.lng ?? null,
        idempotencyKey,
        ignoredPositionIds,
      };

      await apiFetch("/api/clients/checkout/preview", { method: "POST", token, body: payload });
      const checkout = await apiFetch<ApiCheckoutResponse>("/api/clients/checkout", { method: "POST", token, body: payload });

      const orderId = String(checkout.reservedOrderId || checkout.orderId || "");
      const paymentIntentId = String(checkout.paymentIntentId || "");
      const paymentUrl = String(checkout.paymentUrl || "");

      if (paymentUrl) {
        // Replace checkout with orders in history, so "back" from payment goes to orders
        router.replace("/orders");
        window.location.assign(paymentUrl);
      } else {
        router.replace("/orders");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось оформить заказ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onAddressModalClose() {
    setShowAddressModal(false);
    const storeAddress = useDeliveryAddressStore.getState().address;
    const storeCoords = useDeliveryAddressStore.getState().coords;
    if (storeAddress && storeAddress !== localAddress) {
      setLocalAddress(storeAddress);
      setLocalCoords(storeCoords);
      if (storeCoords) doCalculateDelivery(storeCoords, storeAddress);
    }
  }

  if (!pharmacyId) return null;

  return (
    <AppShell top={<TopBar title="Подтверждение заказа" backHref="back" />}>
      <AddressPickerModal open={showAddressModal} onClose={onAddressModalClose} />
      <div className="max-w-2xl mx-auto space-y-4">
        {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        {/* Selected pharmacy */}
        <div className="stitch-card p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Аптека</p>
          <h2 className="text-base font-bold mt-1">{selectedPharmacyTitle || "Аптека"}</h2>
        </div>

        {/* Order items */}
        <div className="stitch-card p-4 space-y-3">
          <h3 className="text-sm font-bold">Позиции заказа</h3>
          <div className="space-y-2">
            {checkoutItems.map((item) => {
              const med = medicineMap[item.medicineId];
              const name = med ? getMedicineDisplayName(med) : item.medicineId;
              const imgUrl = med ? resolveMedicineImageUrl(med) : "";
              const unavailable = !item.hasEnoughQuantity;

              return (
                <div key={item.medicineId} className={`flex items-center gap-3 text-sm ${unavailable ? "opacity-40" : ""}`}>
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt="" className="w-10 h-10 rounded object-contain bg-surface-container-low flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-surface-container-low flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    {unavailable ? <p className="text-[10px] text-red-500">Нет в наличии — не будет в заказе</p> : null}
                  </div>
                  <span className="text-on-surface-variant flex-shrink-0">×{item.requestedQuantity}</span>
                  <span className="font-bold flex-shrink-0">{formatMoney(item.price ?? 0, "TJS")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery address */}
        <div className="stitch-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">{isPickup ? "Самовывоз" : "Доставка"}</h3>
          </div>

          {!isPickup ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAddressModal(true)}
                className="flex items-center gap-2 w-full rounded-full border border-surface-container-high bg-surface-container-lowest px-4 py-2.5 transition hover:bg-surface-container-low text-left"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-sm font-medium text-on-surface truncate">
                  {localAddress || savedAddress || "Выберите адрес доставки"}
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Cost summary */}
        <div className="stitch-card p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Товары</span>
            <span>{formatMoney(itemsAmount, "TJS")}</span>
          </div>
          {!isPickup ? (
            <div className="flex justify-between">
              <span className="text-on-surface-variant">
                Доставка{deliveryDistance != null ? ` (${deliveryDistance.toFixed(1)} км)` : ""}
              </span>
              <span>{isCalculating ? "..." : deliveryCost != null ? formatMoney(deliveryCost, "TJS") : "—"}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-2 border-t border-surface-container-high">
            <span className="font-bold">Итого</span>
            <strong className="text-lg">{formatMoney(totalAmount, "TJS")}</strong>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(goBack())}
            className="stitch-button-secondary flex-1 py-3"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || (!isPickup && !localAddress && !savedAddress)}
            className="stitch-button flex-1 py-3"
          >
            {isSubmitting ? "Оформляем..." : !token ? "Войти и подтвердить" : "Подтвердить"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
