"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { apiFetch } from "@/shared/api/http-client";
import { calculateDelivery } from "@/shared/api/delivery";
import { buildCheckoutIdempotencyKey } from "@/shared/lib/idempotency";
import { formatMoney } from "@/shared/lib/format";
import { openPaymentForCurrentDevice } from "@/shared/lib/responsivePayment";
import { rememberOrderPaymentMethod } from "@/shared/lib/paymentMethodMemory";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { DEFAULT_MEDICINE_IMAGE_URL, getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl, showDefaultMedicineImage } from "@/entities/medicine/api";
import { getMyProfile } from "@/entities/client/api";
import { removeFromBasket } from "@/entities/basket/api";
import { getPublicPaymentSettings, type PublicPaymentSettings } from "@/entities/payment-settings/api";
import type { ApiMedicine, ApiCheckoutResponse, ApiClient } from "@/shared/types/api";
import { preparePaymentWindow } from "@/shared/lib/paymentWindow";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import type { GeoPoint } from "@/shared/lib/map";
import { Button, Chip, Icon, StepProgress } from "@/shared/ui";
import { CartSummary, type CartSummaryRow } from "@/widgets/cart/CartSummary";
import {
  buildPaymentUrlFromTemplate,
  type PaymentMethodOption,
} from "@/widgets/payment/PaymentMethodModal";
import { PaymentMethodLogo } from "@/widgets/payment/PaymentMethodLogo";

const FALLBACK_ALIF_URL_TEMPLATE = "";
const FALLBACK_ESKHATA_URL_TEMPLATE = "";
const DOOR_TO_DOOR_FEE = 5;

function buildCheckoutPaymentMethods(
  paymentSettings: PublicPaymentSettings | null,
  amount: number,
  dcUrl: string,
): PaymentMethodOption[] {
  const methods: PaymentMethodOption[] = [];

  if (paymentSettings?.isDcEnabled !== false) {
    methods.push({
      id: "dc",
      title: "Dushanbe City",
      subtitle: "Оплата через Dushanbe City",
      url: dcUrl,
    });
  }

  const alifUrl = buildPaymentUrlFromTemplate(
    paymentSettings?.alifUrlTemplateEffective ?? FALLBACK_ALIF_URL_TEMPLATE,
    amount,
  );
  if (alifUrl && paymentSettings?.isAlifEnabled !== false) {
    methods.push({
      id: "alif",
      title: "Alif Mobi",
      subtitle: "Оплата через приложение Alif",
      url: alifUrl,
    });
  }

  const eskhataUrl = buildPaymentUrlFromTemplate(
    paymentSettings?.eskhataUrlTemplateEffective ?? FALLBACK_ESKHATA_URL_TEMPLATE,
    amount,
  );
  if (eskhataUrl && paymentSettings?.isEskhataEnabled !== false) {
    methods.push({
      id: "eskhata",
      title: "Эсхата",
      subtitle: "Оплата через приложение Эсхата",
      url: eskhataUrl,
    });
  }

  return methods;
}

export default function CheckoutPage() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const goBack = useGoBack();

  const { basket, loadBasket } = useCartStore();
  const {
    pharmacyId, selectedPharmacyTitle, selectedPharmacyItems,
    isPickup, deliveryCost, deliveryDistance,
    prescriptionId,
    setDeliveryAddressData, setDeliveryCost,
  } = useCheckoutDraftStore();

  const savedAddress = useDeliveryAddressStore((s) => s.address);
  const savedCoords = useDeliveryAddressStore((s) => s.coords);
  const savedAddressTitle = useDeliveryAddressStore((s) => s.title);

  const [localAddress, setLocalAddress] = useState(savedAddress);
  const [localCoords, setLocalCoords] = useState<GeoPoint | null>(savedCoords);
  const [localAddressTitle, setLocalAddressTitle] = useState<string | null>(savedAddressTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [profile, setProfile] = useState<ApiClient | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [selectedMedIds, setSelectedMedIds] = useState<Set<string>>(new Set());
  const [selectionInited, setSelectionInited] = useState(false);
  const [comment, setComment] = useState("");
  const [entrance, setEntrance] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [deliverToDoor, setDeliverToDoor] = useState(false);
  const [courierDetails, setCourierDetails] = useState("");
  const [showCourierDetails, setShowCourierDetails] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PublicPaymentSettings | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<PaymentMethodOption["id"]>("dc");
  const courierDetailsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!pharmacyId) { router.replace("/cart/pharmacy"); return; }
    // Auth is gated at the pharmacy-picker step — but if the user lands here
    // without a token (e.g. direct URL, stale tab) kick them to login with a
    // return-to-checkout hop so the flow stays consistent.
    if (!token) { router.replace("/login?redirect=/checkout"); return; }
    loadBasket(token).catch(() => undefined);
  }, [token, pharmacyId, router, loadBasket]);

  useEffect(() => {
    if (!token) return;
    setProfileLoaded(false);
    getMyProfile(token)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoaded(true));
  }, [token]);

  useEffect(() => {
    getPublicPaymentSettings().then(setPaymentSettings).catch(() => undefined);
  }, []);

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
        // Unit-mode rows contribute the pharmacist's flat total directly,
        // bypassing the price × quantity formula.
        if (i.useUnitMode && i.unitTotalPrice != null) return sum + i.unitTotalPrice;
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
    setDeliveryCost(null, null);
    setError(null);
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
      setError("Не удалось рассчитать доставку. Выберите адрес ещё раз.");
    }
    setIsCalculating(false);
  }, [pharmacyId, isPickup, setDeliveryCost, setDeliveryAddressData]);

  useEffect(() => {
    if (savedCoords && savedAddress && !isPickup) {
      doCalculateDelivery(savedCoords, savedAddress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCoords?.lat, savedCoords?.lng, savedAddress, isPickup]);

  const doorToDoorFee = !isPickup && deliverToDoor ? DOOR_TO_DOOR_FEE : 0;
  const effectiveDeliveryCost = isPickup ? 0 : (deliveryCost ?? 0) + doorToDoorFee;
  const totalAmount = itemsAmount + effectiveDeliveryCost;
  const effectiveAddress = localAddress || savedAddress;
  const effectiveCoords = localCoords ?? savedCoords;
  const hasDeliveryAddress = isPickup || Boolean(effectiveAddress?.trim() && effectiveCoords);
  const hasCalculatedDelivery = isPickup || deliveryCost != null;
  const canSubmitOrder = selectedCount > 0
    && (isPickup || (hasDeliveryAddress && hasCalculatedDelivery && !isCalculating));
  const checkoutPaymentMethods = useMemo(
    () => buildCheckoutPaymentMethods(paymentSettings, totalAmount, ""),
    [paymentSettings, totalAmount],
  );

  useEffect(() => {
    if (checkoutPaymentMethods.length === 0) return;
    if (!checkoutPaymentMethods.some((method) => method.id === selectedPaymentMethodId)) {
      setSelectedPaymentMethodId(checkoutPaymentMethods[0].id);
    }
  }, [checkoutPaymentMethods, selectedPaymentMethodId]);

  async function onSubmit() {
    if (!pharmacyId) return;
    // Defensive: the pharmacy-picker step gates auth, but if the user ends up
    // here without a token (direct URL / stale tab), redirect to login.
    if (!token) {
      router.push("/login?redirect=/checkout");
      return;
    }
    if (selectedCount === 0) return;
    if (!isPickup) {
      if (!hasDeliveryAddress) {
        setError("Выберите адрес доставки на карте.");
        return;
      }
      if (!hasCalculatedDelivery) {
        setError("Сначала нужно рассчитать доставку для выбранного адреса.");
        return;
      }
    }
    setIsSubmitting(true);
    setError(null);
    const preparedPaymentWindow = preparePaymentWindow("Оплата Yalla Pharm");

    // Explicit source — send exactly the medicines the user selected for this
    // pharmacy, so the backend doesn't sweep in unrelated basket items (e.g. a
    // medicine left from a prior session that the chosen pharmacy doesn't sell).
    // `consumeFromBasket: true` tells the backend to drop matching basket rows
    // after the order is created.
    const explicitPositions = checkoutItems
      .filter((i) => selectedMedIds.has(i.medicineId))
      .map((i) => ({
        medicineId: i.medicineId,
        quantity: Math.min(i.foundQuantity, i.requestedQuantity),
      }))
      .filter((p) => p.quantity > 0);

    // Positions the user unchecked on this screen — they chose to skip them for
    // this order, so clean them out of the basket too (mirrors the prior UX).
    // Skipped entirely in prescription mode: that flow is supposed to leave
    // the user's basket strictly alone (prescription items aren't there).
    const positionsByMedId: Record<string, string> = {};
    for (const p of basket.positions ?? []) positionsByMedId[p.medicineId] = p.id;
    const uncheckedBasketPositionIds = prescriptionId
      ? []
      : checkoutItems
          .filter((i) => !selectedMedIds.has(i.medicineId))
          .map((i) => positionsByMedId[i.medicineId])
          .filter((id): id is string => Boolean(id));

    try {
      const idempotencyKey = buildCheckoutIdempotencyKey();
      const effectiveTitle = localAddressTitle ?? savedAddressTitle;
      // Prescription-checkout flow: don't consume basket positions and tag
      // the source with prescriptionId so the backend transitions the
      // prescription Decoded → OrderPlaced atomically with the order.
      const isPrescriptionFlow = !!prescriptionId;
      const payload = {
        pharmacyId,
        isPickup,
        deliveryAddress: effectiveAddress,
        // Pass the user-chosen label when available (so it's persisted on the
        // ClientAddress record); otherwise fall back to the raw address — the
        // backend uses this for delivery API title and admin display.
        deliveryAddressTitle: effectiveTitle ?? effectiveAddress,
        deliveryLatitude: effectiveCoords?.lat ?? null,
        deliveryLongitude: effectiveCoords?.lng ?? null,
        idempotencyKey,
        ignoredPositionIds: [] as string[],
        comment: comment.trim() ? comment.trim() : null,
        deliverToDoor: !isPickup && deliverToDoor,
        courierDetails: courierDetails.trim() ? courierDetails.trim() : null,
        entrance: parsePositiveInt(entrance),
        floor: parsePositiveInt(floor),
        apartment: parsePositiveInt(apartment),
        source: {
          kind: 2, // CheckoutSourceKind.Explicit
          positions: explicitPositions,
          // Regular cart-flow: clear matching basket rows after the order
          // commits. Prescription-flow: leave the basket strictly alone.
          consumeFromBasket: !isPrescriptionFlow,
          prescriptionId: isPrescriptionFlow ? prescriptionId : null,
        },
      };

      await apiFetch("/api/clients/checkout/preview", { method: "POST", token, body: payload });
      const checkout = await apiFetch<ApiCheckoutResponse>("/api/clients/checkout", { method: "POST", token, body: payload });

      if (uncheckedBasketPositionIds.length > 0) {
        await Promise.all(
          uncheckedBasketPositionIds.map((positionId) =>
            removeFromBasket(token, positionId).catch(() => undefined)
          )
        );
      }

      const paymentUrl = String(checkout.paymentUrl || "");
      if (paymentUrl) {
        const amount = Number(checkout.amount ?? checkout.cost ?? totalAmount);
        const methods = buildCheckoutPaymentMethods(paymentSettings, amount, paymentUrl);
        const selectedMethod = methods.find((method) => method.id === selectedPaymentMethodId) ?? methods[0];
        if (selectedMethod) {
          rememberOrderPaymentMethod(checkout.orderId ?? checkout.reservedOrderId, selectedMethod.id);
          openPaymentForCurrentDevice({
            url: selectedMethod.url,
            title: selectedMethod.title,
            subtitle: selectedMethod.subtitle,
            amount,
            paymentWindow: preparedPaymentWindow,
          });
        } else {
          preparedPaymentWindow?.close();
        }

        router.replace(prescriptionId ? "/prescriptions" : "/orders");
      } else {
        preparedPaymentWindow?.close();
        router.replace("/orders");
      }
    } catch (err) {
      preparedPaymentWindow?.close();
      setError(err instanceof Error ? err.message : "Не удалось оформить заказ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onAddressModalClose() {
    setShowAddressModal(false);
    const storeState = useDeliveryAddressStore.getState();
    const storeAddress = storeState.address;
    const storeCoords = storeState.coords;
    const storeTitle = storeState.title;
    const coordsChanged = storeCoords?.lat !== localCoords?.lat || storeCoords?.lng !== localCoords?.lng;
    if (storeAddress && (storeAddress !== localAddress || coordsChanged)) {
      setLocalAddress(storeAddress);
      setLocalCoords(storeCoords);
      setLocalAddressTitle(storeTitle);
      if (storeCoords) doCalculateDelivery(storeCoords, storeAddress);
      else setDeliveryCost(null, null);
    } else if (storeTitle !== localAddressTitle) {
      // Title may have changed (rename) without address changing.
      setLocalAddressTitle(storeTitle);
    }
  }

  if (!pharmacyId) return null;

  const summaryRows: CartSummaryRow[] = [
    { label: `Товары${selectedCount ? ` · ${selectedCount}` : ""}`, value: itemsAmount },
    ...(!isPickup
      ? [{
          label: "Доставка",
          hint: deliveryDistance != null
            ? `${deliveryDistance.toFixed(1)} км${deliverToDoor ? " · до двери" : ""}`
            : (deliverToDoor ? "до двери" : undefined),
          value: effectiveDeliveryCost
        }]
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
              className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left transition active:scale-95 hover:bg-surface-container-high"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="pin" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                {/* When a saved address has a user label (Дом/Работа), show it
                    as the headline so the user recognises the place at a
                    glance; the raw street stays as the secondary line. */}
                <span className="block truncate text-sm font-bold text-on-surface">
                  {localAddressTitle || savedAddressTitle || localAddress || savedAddress || "Выберите адрес"}
                </span>
                <span className="block truncate text-[11px] text-on-surface-variant">
                  {(localAddressTitle || savedAddressTitle)
                    ? (localAddress || savedAddress || "Душанбе")
                    : "Душанбе"}
                </span>
              </span>
            </button>

            <div className="mt-3 rounded-2xl bg-surface-container-low p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-on-surface">Доставить до двери</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-on-surface-variant">+5.00 TJS к доставке</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={deliverToDoor}
                  onClick={() => {
                    setDeliverToDoor((value) => {
                      const next = !value;
                      if (next) {
                        setShowCourierDetails(true);
                        window.setTimeout(() => courierDetailsRef.current?.focus(), 80);
                      } else {
                        setShowCourierDetails(false);
                      }
                      return next;
                    });
                  }}
                  className={`relative h-8 w-14 flex-shrink-0 rounded-full p-1 transition ${
                    deliverToDoor ? "bg-primary" : "bg-outline"
                  }`}
                >
                  <span
                    className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                      deliverToDoor ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {deliverToDoor ? (
                <button
                  type="button"
                  onClick={() => setShowCourierDetails((value) => !value)}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-surface-container-high px-3 py-2 text-left text-xs font-bold text-on-surface transition active:scale-95"
                  aria-expanded={showCourierDetails}
                >
                  <span>Детали для курьера</span>
                  <Icon
                    name="chevron-down"
                    size={16}
                    className={`transition-transform ${showCourierDetails ? "rotate-180" : ""}`}
                  />
                </button>
              ) : null}
            </div>

            {deliverToDoor && showCourierDetails ? (
              <>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Уточнение для курьера
                  </p>
                  <p className="text-[10px] text-on-surface-variant/70">необязательно</p>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <NumericField label="Подъезд" value={entrance} onChange={setEntrance} />
                  <NumericField label="Этаж" value={floor} onChange={setFloor} />
                  <NumericField label="Квартира" value={apartment} onChange={setApartment} />
                </div>
                <textarea
                  ref={courierDetailsRef}
                  value={courierDetails}
                  onChange={(e) => setCourierDetails(e.target.value.slice(0, 1024))}
                  placeholder="Например: домофон 12, дверь слева"
                  rows={2}
                  maxLength={1024}
                  className="mt-2 w-full resize-none rounded-2xl bg-surface-container-low p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </>
            ) : null}
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
            {profileLoaded && !hasContact ? (
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
              const imgUrl = med ? resolveMedicineImageUrl(med, 240) : DEFAULT_MEDICINE_IMAGE_URL;
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt=""
                    onError={(event) => showDefaultMedicineImage(event.currentTarget)}
                    className={`h-12 w-12 flex-shrink-0 rounded-xl bg-image-backdrop object-contain mix-blend-multiply ${missing ? "grayscale" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${missing ? "line-through text-on-surface-variant" : ""}`}>
                      {name}
                      {item.useUnitMode && item.unitTotalPrice != null ? (
                        <span className="ml-2 rounded-full bg-accent-sun/30 px-2 py-0.5 align-middle text-[10px] font-bold text-accent-sun-ink">
                          поштучно
                        </span>
                      ) : null}
                    </p>
                    {missing ? (
                      <Chip tone="danger" asButton={false} size="sm">В этой аптеке нет</Chip>
                    ) : partial ? (
                      <Chip tone="warning" asButton={false} size="sm">
                        Доступно {item.foundQuantity} из {item.requestedQuantity}
                      </Chip>
                    ) : item.useUnitMode && item.unitTotalPrice != null ? (
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        {item.unitCount ?? 0} шт.
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        {formatMoney(item.price ?? 0)} × {cappedFound}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 font-extrabold tabular-nums text-primary">
                    {formatMoney(
                      item.useUnitMode && item.unitTotalPrice != null
                        ? item.unitTotalPrice
                        : (item.price ?? 0) * cappedFound,
                    )}
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

        <section className="rounded-3xl bg-surface-container-lowest p-4 shadow-card">
          <div className="mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Способ оплаты
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Выберите метод, который откроется после подтверждения заказа.
            </p>
          </div>
          {checkoutPaymentMethods.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-low p-3 text-sm font-semibold text-on-surface-variant">
              Сейчас нет доступных способов оплаты.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {checkoutPaymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedPaymentMethodId(method.id)}
                  className={`flex min-h-[86px] flex-col items-start justify-between rounded-2xl border p-2 text-left transition active:scale-[0.98] sm:min-h-[104px] sm:p-3 ${
                    selectedPaymentMethodId === method.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-outline/60 bg-surface-container-low text-on-surface hover:border-primary/40"
                  }`}
                >
                  <PaymentMethodLogo
                    methodId={method.id}
                    className="h-9 w-16 px-2 sm:h-10 sm:w-[86px]"
                  />
                  <span>
                    <span className="block break-words text-[11px] font-extrabold leading-tight sm:text-sm">
                      {method.title}
                    </span>
                    <span className="mt-1 hidden text-[11px] font-semibold leading-tight opacity-75 sm:block">
                      {method.subtitle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Summary */}
        <CartSummary
          rows={summaryRows}
          total={totalAmount}
        />

        {/* Confirm CTA — anchored at the very bottom of the order card. Sits
            below the totals so the button is the last thing in the flow.
            Bottom padding leaves room for the global BottomNav on mobile. */}
        <div className="pb-4">
          <Button
            size="lg"
            fullWidth
            rightIcon="arrow-right"
            onClick={onSubmit}
            loading={isSubmitting || isCalculating}
            disabled={!canSubmitOrder}
          >
            {selectedCount === 0
              ? "Выберите позиции"
            : !isPickup && !hasDeliveryAddress
              ? "Выберите адрес доставки"
            : !isPickup && !hasCalculatedDelivery
              ? "Рассчитайте доставку"
            : `Подтвердить · ${formatMoney(totalAmount)}`}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(digits);
        }}
        placeholder="—"
        className="w-full rounded-2xl bg-surface-container-low px-3 py-2 text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
