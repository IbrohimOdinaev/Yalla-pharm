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
import { Button, Chip, Icon, StepProgress } from "@/shared/ui";
import { CartSummary, type CartSummaryRow } from "@/widgets/cart/CartSummary";

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

  useEffect(() => {
    if (!pharmacyId) { router.replace("/cart/pharmacy"); return; }
    if (token) loadBasket(token).catch(() => undefined);
  }, [token, pharmacyId, router, loadBasket]);

  useEffect(() => {
    if (!token) return;
    getMyProfile(token).then(setProfile).catch(() => undefined);
  }, [token]);

  const checkoutItems = selectedPharmacyItems;

  useEffect(() => {
    if (selectionInited || checkoutItems.length === 0) return;
    // Pre-check everything the pharmacy actually has in stock — full matches AND
    // partial ones. Only completely out-of-stock positions stay unchecked (and
    // the toggle below refuses to enable them).
    const initial = new Set<string>();
    for (const item of checkoutItems) {
      if (item.isFound && item.foundQuantity > 0) initial.add(item.medicineId);
    }
    setSelectedMedIds(initial);
    setSelectionInited(true);
  }, [checkoutItems, selectionInited]);

  function toggleSelection(medicineId: string) {
    // Out-of-stock items must never join the order — ignore any attempt to
    // check them (defensive against clicks leaking through a disabled input).
    const item = checkoutItems.find((i) => i.medicineId === medicineId);
    if (!item || !item.isFound || item.foundQuantity <= 0) return;

    setSelectedMedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medicineId)) next.delete(medicineId);
      else next.add(medicineId);
      return next;
    });
  }

  const itemsAmount = useMemo(() => {
    return checkoutItems
      .filter((i) => selectedMedIds.has(i.medicineId))
      .reduce((sum, i) => {
        const qty = Math.min(i.foundQuantity, i.requestedQuantity);
        return sum + (i.price ?? 0) * qty;
      }, 0);
  }, [checkoutItems, selectedMedIds]);

  const selectedCount = selectedMedIds.size;

  const profilePhone = profile?.phoneNumber ?? "";
  const phoneLinked = !!profilePhone && !profilePhone.startsWith("tg_");
  const telegramLinked = !!profile?.telegramUsername || !!profile?.telegramId;
  const hasContact = phoneLinked || telegramLinked;

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

  const summaryRows: CartSummaryRow[] = [
    { label: `Товары${selectedCount ? ` · ${selectedCount}` : ""}`, value: itemsAmount },
    ...(!isPickup
      ? [{ label: "Доставка", hint: deliveryDistance != null ? `${deliveryDistance.toFixed(1)} км` : undefined, value: deliveryCost ?? 0 }]
      : []),
  ];

  return (
    <AppShell hideFooter top={<TopBar title="Оформление" backHref="back" />}>
      <AddressPickerModal open={showAddressModal} onClose={onAddressModalClose} />
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Step progress */}
        <StepProgress
          steps={[{ label: "Корзина" }, { label: "Оформление" }, { label: "Оплата" }]}
          current={1}
          className="mb-2"
        />

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {/* Method + Pharmacy */}
        <section className="flex gap-3">
          <div className={`flex-1 rounded-3xl p-4 shadow-card ${isPickup ? "bg-surface-container-lowest" : "bg-gradient-to-br from-primary to-primary-container text-white"}`}>
            <div className="flex items-center gap-2">
              <Icon name="truck" size={20} />
              <span className="text-xs font-bold uppercase tracking-wide">
                {isPickup ? "Доставка" : "Доставка"}
              </span>
            </div>
            <p className="mt-2 text-sm font-extrabold">
              {isPickup ? "Недоступно" : `30–45 мин · ${deliveryCost != null ? formatMoney(deliveryCost) + " TJS" : "—"}`}
            </p>
          </div>
          <div className={`flex-1 rounded-3xl p-4 shadow-card ${isPickup ? "bg-gradient-to-br from-primary to-primary-container text-white" : "bg-surface-container-lowest"}`}>
            <div className="flex items-center gap-2">
              <Icon name="store" size={20} />
              <span className="text-xs font-bold uppercase tracking-wide">Самовывоз</span>
            </div>
            <p className="mt-2 text-sm font-extrabold">
              {isPickup ? "Бесплатно" : "Выберите в корзине"}
            </p>
          </div>
        </section>

        {/* Pharmacy card */}
        <section className="rounded-3xl bg-surface-container-lowest p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Аптека</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-mint text-primary">
              <Icon name="pharmacy" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-extrabold">{selectedPharmacyTitle || "Аптека"}</h2>
              <p className="text-xs text-on-surface-variant">Подтверждение от фармацевта</p>
            </div>
          </div>
        </section>

        {/* Address */}
        {!isPickup ? (
          <section className="rounded-3xl bg-surface-container-lowest p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Адрес доставки</p>
              <button type="button" onClick={() => setShowAddressModal(true)} className="text-xs font-bold text-primary">
                Изменить
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAddressModal(true)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left transition hover:bg-surface-container-high"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="pin" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-on-surface">
                  {localAddress || savedAddress || "Выберите адрес"}
                </span>
                <span className="block text-[11px] text-on-surface-variant">Душанбе</span>
              </span>
            </button>
          </section>
        ) : null}

        {/* Recipient */}
        {profile ? (
          <section className="rounded-3xl bg-surface-container-lowest p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Получатель</p>
              <Link href="/profile" className="text-xs font-bold text-primary">
                Профиль →
              </Link>
            </div>
            <div className="space-y-2 text-sm">
              {profile.name ? (
                <div className="flex items-center gap-2">
                  <Icon name="user" size={16} className="text-on-surface-variant" />
                  <span className="font-semibold">{profile.name}</span>
                </div>
              ) : null}
              {phoneLinked ? (
                <div className="flex items-center gap-2">
                  <Icon name="phone" size={16} className="text-on-surface-variant" />
                  <span className="font-mono">+{profile.phoneNumber}</span>
                </div>
              ) : null}
              {telegramLinked ? (
                <div className="flex items-center gap-2">
                  <Icon name="telegram" size={16} className="text-telegram" />
                  <span>@{profile.telegramUsername}</span>
                </div>
              ) : null}
            </div>
            {!hasContact ? (
              <div className="mt-3 rounded-2xl bg-warning-soft p-3">
                <p className="text-sm font-bold text-warning">Нет контакта для связи</p>
                <p className="mt-1 text-xs text-warning/90">
                  Привяжите номер телефона или Telegram в профиле.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Items */}
        <section className="rounded-3xl bg-surface-container-lowest p-4 shadow-card">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display text-base font-extrabold">Позиции заказа</h3>
            <span className="text-xs font-semibold text-on-surface-variant">
              {selectedCount} из {checkoutItems.length}
            </span>
          </div>
          <ul className="space-y-2">
            {checkoutItems.map((item) => {
              const med = medicineMap[item.medicineId];
              const name = med ? getMedicineDisplayName(med) : item.medicineId;
              const imgUrl = med ? resolveMedicineImageUrl(med) : "";
              const enough = item.hasEnoughQuantity;
              const partial = item.isFound && !enough && item.foundQuantity > 0;
              const missing = !item.isFound || item.foundQuantity <= 0;
              const checked = selectedMedIds.has(item.medicineId);
              const cappedFound = Math.min(item.foundQuantity, item.requestedQuantity);

              // Out-of-stock row is rendered but **locked**: no pointer, no checkbox,
              // no hover state. Partial stock rows stay toggleable and pre-checked.
              const rowBase = "flex items-center gap-3 rounded-2xl p-2.5 transition";
              const rowState = missing
                ? "bg-surface-container-low opacity-55 cursor-not-allowed"
                : checked
                  ? "bg-primary/5 cursor-pointer"
                  : "bg-surface-container-low cursor-pointer";

              return (
                <label
                  key={item.medicineId}
                  className={`${rowBase} ${rowState}`}
                  aria-disabled={missing}
                >
                  <input
                    type="checkbox"
                    checked={checked && !missing}
                    onChange={() => toggleSelection(item.medicineId)}
                    disabled={missing}
                    className="h-4 w-4 flex-shrink-0 accent-primary disabled:cursor-not-allowed"
                  />
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl}
                      alt=""
                      className={`h-12 w-12 flex-shrink-0 rounded-xl bg-accent-mint object-cover ${missing ? "grayscale" : ""}`}
                    />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent-mint text-primary/40">
                      <Icon name="bag" size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${missing ? "line-through text-on-surface-variant" : ""}`}>{name}</p>
                    {missing ? (
                      <Chip tone="danger" asButton={false} size="sm">Нет в наличии</Chip>
                    ) : partial ? (
                      <Chip tone="warning" asButton={false} size="sm">
                        Доступно {item.foundQuantity} из {item.requestedQuantity}
                      </Chip>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        {formatMoney(item.price ?? 0)} × {cappedFound}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 font-extrabold tabular-nums text-primary">
                    {formatMoney((item.price ?? 0) * cappedFound)}
                  </span>
                </label>
              );
            })}
          </ul>
        </section>

        {/* Comment */}
        <section className="rounded-3xl bg-surface-container-lowest p-4 shadow-card">
          <label htmlFor="order-comment" className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Комментарий
            </span>
            <span className="text-[10px] text-on-surface-variant/70">{comment.length}/1024</span>
          </label>
          <textarea
            id="order-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1024))}
            placeholder="Например: позвоните за 10 минут до приезда"
            rows={3}
            maxLength={1024}
            className="w-full resize-none rounded-2xl bg-surface-container-low p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </section>

        {/* Summary */}
        <CartSummary
          rows={summaryRows}
          total={totalAmount}
          hint={!isPickup && deliveryCost != null ? "Доставим за 30–45 мин" : undefined}
        />

        {/* Spacer for sticky CTA */}
        <div className="h-24" />
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-3 sm:bottom-4">
        <div className="mx-auto max-w-2xl rounded-full bg-surface-container-lowest p-1.5 shadow-glass">
          <Button
            size="lg"
            fullWidth
            rightIcon="arrow-right"
            onClick={onSubmit}
            loading={isSubmitting || isCalculating}
            disabled={selectedCount === 0 || (!isPickup && !localAddress && !savedAddress) || !hasContact}
          >
            {!token
              ? "Войти и подтвердить"
              : selectedCount === 0
                ? "Выберите позиции"
                : !hasContact
                  ? "Нужен контакт"
                  : `Подтвердить · ${formatMoney(totalAmount)} TJS`}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
