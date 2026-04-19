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
import { getMyProfile } from "@/entities/client/api";
import { removeFromBasket } from "@/entities/basket/api";
import type { ApiMedicine, ApiCheckoutResponse, ApiClient } from "@/shared/types/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import type { GeoPoint } from "@/shared/lib/map";

export default function CheckoutPage() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const goBack = useGoBack();

  const { basket, loadBasket } = useCartStore();
  const {
    pharmacyId, selectedPharmacyTitle, selectedPharmacyItems,
    isPickup, deliveryCost, deliveryDistance,
    setDeliveryAddressData, setDeliveryCost,
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
  const [profile, setProfile] = useState<ApiClient | null>(null);
  const [selectedMedIds, setSelectedMedIds] = useState<Set<string>>(new Set());
  const [selectionInited, setSelectionInited] = useState(false);
  const [comment, setComment] = useState("");

  // Guards
  useEffect(() => {
    if (!pharmacyId) { router.replace("/cart/pharmacy"); return; }
    if (token) loadBasket(token).catch(() => undefined);
  }, [token, pharmacyId, router, loadBasket]);

  // Load client profile (phone / telegram) for recipient display
  useEffect(() => {
    if (!token) return;
    getMyProfile(token).then(setProfile).catch(() => undefined);
  }, [token]);

  // Use items from store (works for both auth and guest)
  const checkoutItems = selectedPharmacyItems;

  // Initialize selection: items in stock are checked by default, out-of-stock unchecked
  useEffect(() => {
    if (selectionInited || checkoutItems.length === 0) return;
    const initial = new Set<string>();
    for (const item of checkoutItems) {
      if (item.hasEnoughQuantity) initial.add(item.medicineId);
    }
    setSelectedMedIds(initial);
    setSelectionInited(true);
  }, [checkoutItems, selectionInited]);

  function toggleSelection(medicineId: string) {
    setSelectedMedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medicineId)) next.delete(medicineId);
      else next.add(medicineId);
      return next;
    });
  }

  // Sum = price * actual delivered qty (min(found, requested)) for every selected position
  const itemsAmount = useMemo(() => {
    return checkoutItems
      .filter((i) => selectedMedIds.has(i.medicineId))
      .reduce((sum, i) => {
        const qty = Math.min(i.foundQuantity, i.requestedQuantity);
        return sum + (i.price ?? 0) * qty;
      }, 0);
  }, [checkoutItems, selectedMedIds]);

  const selectedCount = selectedMedIds.size;

  // Phone is optional — a linked Telegram account is an acceptable contact
  // channel. At least one of (phone | telegram) must be present.
  const profilePhone = profile?.phoneNumber ?? "";
  const phoneLinked = !!profilePhone && !profilePhone.startsWith("tg_");
  const telegramLinked = !!profile?.telegramUsername || !!profile?.telegramId;
  const hasContact = phoneLinked || telegramLinked;

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
    if (selectedCount === 0) return;
    if (!hasContact) {
      setError("Привяжите номер телефона или Telegram-аккаунт в профиле.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    // Map medicineId -> basket positionId. Anything client unselected becomes ignored
    // for checkout AND must be removed from the basket afterwards (backend keeps them).
    const positionsByMedId: Record<string, string> = {};
    for (const p of basket.positions ?? []) positionsByMedId[p.medicineId] = p.id;
    const ignoredPositionIds = checkoutItems
      .filter((i) => !selectedMedIds.has(i.medicineId))
      .map((i) => positionsByMedId[i.medicineId])
      .filter((id): id is string => Boolean(id));

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
        comment: comment.trim() ? comment.trim() : null,
      };

      await apiFetch("/api/clients/checkout/preview", { method: "POST", token, body: payload });
      const checkout = await apiFetch<ApiCheckoutResponse>("/api/clients/checkout", { method: "POST", token, body: payload });

      // Backend keeps the unselected (ignored) positions in basket — wipe them now
      if (ignoredPositionIds.length > 0) {
        await Promise.all(
          ignoredPositionIds.map((positionId) =>
            removeFromBasket(token, positionId).catch(() => undefined)
          )
        );
      }

      const paymentUrl = String(checkout.paymentUrl || "");
      if (paymentUrl) {
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
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold">Позиции заказа</h3>
            <span className="text-xs text-on-surface-variant">Выбрано {selectedCount} из {checkoutItems.length}</span>
          </div>
          <div className="space-y-2">
            {checkoutItems.map((item) => {
              const med = medicineMap[item.medicineId];
              const name = med ? getMedicineDisplayName(med) : item.medicineId;
              const imgUrl = med ? resolveMedicineImageUrl(med) : "";
              const enough = item.hasEnoughQuantity;
              const partial = item.isFound && !enough;
              const missing = !item.isFound;
              const checked = selectedMedIds.has(item.medicineId);
              const cappedFound = Math.min(item.foundQuantity, item.requestedQuantity);

              return (
                <label
                  key={item.medicineId}
                  className={`flex items-center gap-3 text-sm rounded-xl px-2 py-1.5 cursor-pointer transition ${checked ? "bg-primary/5" : "hover:bg-surface-container-low"} ${!checked ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelection(item.medicineId)}
                    className="w-4 h-4 accent-primary flex-shrink-0"
                  />
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt="" className="w-10 h-10 rounded object-contain bg-surface-container-low flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-surface-container-low flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    {missing ? (
                      <p className="text-[10px] text-red-500">Нет в наличии</p>
                    ) : partial ? (
                      <p className="text-[10px] text-amber-600">Доступно только {item.foundQuantity} из {item.requestedQuantity}</p>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-shrink-0 text-xs tabular-nums">
                    <span className="text-on-surface-variant">{formatMoney(item.price ?? 0, "TJS")}</span>
                    <span className="text-on-surface-variant">×</span>
                    <span className={enough ? "text-on-surface-variant" : "text-amber-600 font-semibold"}>{cappedFound}/{item.requestedQuantity}</span>
                    <span className="text-on-surface-variant">=</span>
                    <span className="font-bold text-sm text-on-surface">{formatMoney((item.price ?? 0) * cappedFound, "TJS")}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Recipient (phone / telegram) */}
        {profile ? (
          <div className="stitch-card p-4 space-y-2">
            <h3 className="text-sm font-bold">Получатель</h3>
            <div className="space-y-1.5 text-sm">
              {profile.name ? (
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-on-surface-variant flex-shrink-0"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                  <span className="font-medium">{profile.name}</span>
                </div>
              ) : null}
              {profile.phoneNumber && !profile.phoneNumber.startsWith("tg_") ? (
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-on-surface-variant flex-shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  <span className="font-mono">+{profile.phoneNumber}</span>
                </div>
              ) : null}
              {profile.telegramUsername ? (
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#229ED9] flex-shrink-0"><path d="M21.943 4.116a1.5 1.5 0 0 0-1.567-.196L2.91 11.123a1.5 1.5 0 0 0 .128 2.787l4.378 1.477 1.69 5.39a1 1 0 0 0 1.69.39l2.42-2.42 4.55 3.34a1.5 1.5 0 0 0 2.367-.94l3-15a1.5 1.5 0 0 0-1.19-1.83zM10 16l-.66 3.13L8 14.5l9-7-7 8.5z"/></svg>
                  <span>@{profile.telegramUsername}</span>
                </div>
              ) : null}
            </div>

            {!hasContact ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Нет контакта для связи</p>
                <p className="text-xs text-amber-800">Привяжите номер телефона <b>или</b> Telegram-аккаунт в профиле — достаточно одного способа.</p>
                <Link href="/profile" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                  Перейти в профиль
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

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

        {/* Comment */}
        <div className="stitch-card p-4 space-y-2">
          <label htmlFor="order-comment" className="text-sm font-bold">Комментарий к заказу</label>
          <textarea
            id="order-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1024))}
            placeholder="Например: позвоните за 10 минут до приезда"
            rows={3}
            className="stitch-input resize-none"
            maxLength={1024}
          />
          <p className="text-[11px] text-on-surface-variant text-right">{comment.length}/1024</p>
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
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                goBack();
                router.back();
              } else {
                router.push(goBack());
              }
            }}
            className="stitch-button-secondary flex-1 py-3"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || selectedCount === 0 || (!isPickup && !localAddress && !savedAddress) || !hasContact}
            className="stitch-button flex-1 py-3"
          >
            {isSubmitting
              ? "Оформляем..."
              : !token
                ? "Войти и подтвердить"
                : selectedCount === 0
                  ? "Выберите позиции"
                  : !hasContact
                    ? "Нужен контакт"
                    : "Подтвердить"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
