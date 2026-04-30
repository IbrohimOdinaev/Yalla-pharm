"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine, ApiBasketPharmacyOption, ApiBasketPharmacyItem } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useAppSelector } from "@/shared/lib/redux";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { getPickupAvailability } from "@/features/pharmacy/model/pharmacyHours";
import { usePharmacyAddresses } from "@/features/pharmacy/model/usePharmacyAddresses";
import { usePharmacyDeliveryCosts } from "@/features/pharmacy/model/usePharmacyDeliveryCosts";
import { setGuestCheckoutIntent } from "@/shared/lib/guest-intent";

import { GlobalTopBar } from "@/widgets/layout/GlobalTopBar";
import { Button, Chip, Icon, IconButton, PharmacyLogo } from "@/shared/ui";
import dynamic from "next/dynamic";

type PharmacySort = "cheapest" | "most-positions";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

export default function PharmacySelectPage() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const goBack = useGoBack();
  const { basket, loadBasket } = useCartStore();
  const guestItems = useGuestCartStore((s) => s.items);
  const setDraft = useCheckoutDraftStore((s) => s.setDraft);
  const deliveryCoords = useDeliveryAddressStore((s) => s.coords);

  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [expandedId, setExpandedId] = useState<string>("");
  const [highlightedId, setHighlightedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPickup, setIsPickup] = useState(false);
  const [sortMode, setSortMode] = useState<PharmacySort>("cheapest");
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const resolvedAddresses = usePharmacyAddresses(pharmacies);
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Cart items — server for auth, guest for unauth
  const cartItems = useMemo(() => {
    if (token && (basket.positions ?? []).length > 0) {
      return (basket.positions ?? []).map((p) => ({ medicineId: p.medicineId, quantity: p.quantity }));
    }
    return guestItems;
  }, [token, basket.positions, guestItems]);

  // Load data
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        // Load pharmacies — always use public endpoint (has coordinates for all users)
        const pharmsPromise = getActivePharmacies();
        const [pharms] = await Promise.all([
          pharmsPromise,
          token ? loadBasket(token) : Promise.resolve(),
        ]);
        setPharmacies(pharms);
      } catch { /* ignore */ }
      setIsLoading(false);
    }
    load();
  }, [token, loadBasket]);

  // Load medicine details for items in cart
  useEffect(() => {
    const ids = cartItems.map((i) => i.medicineId).filter((id) => !medicineMap[id]);
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => getMedicineById(id).catch(() => null))).then((results) => {
      const map: Record<string, ApiMedicine> = { ...medicineMap };
      for (const m of results) {
        if (m?.id) map[m.id] = m;
      }
      setMedicineMap(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems]);

  // Build pharmacy geo lookup
  const pharmacyGeo = useMemo(() => {
    const map: Record<string, ActivePharmacy> = {};
    for (const p of pharmacies) map[p.id] = p;
    return map;
  }, [pharmacies]);

  // Sum across in-stock-at-required-qty items only
  function availableItemsTotal(items: ApiBasketPharmacyItem[] | undefined) {
    return (items ?? [])
      .filter((i) => i.hasEnoughQuantity)
      .reduce((sum, i) => sum + (i.price ?? 0) * i.requestedQuantity, 0);
  }

  // Sort comparator applied to both server-built and guest-computed options.
  // `cheapest`: ascending by total of in-stock items. `most-positions`: descending
  // by number of fully-available items, tie-broken by cheaper total.
  const sortOptions = useCallback(
    (list: ApiBasketPharmacyOption[]) => {
      const byCost = (o: ApiBasketPharmacyOption) => availableItemsTotal(o.items);
      if (sortMode === "most-positions") {
        return [...list].sort((a, b) => {
          const ea = a.enoughQuantityMedicinesCount ?? 0;
          const eb = b.enoughQuantityMedicinesCount ?? 0;
          if (eb !== ea) return eb - ea;
          return byCost(a) - byCost(b);
        });
      }
      return [...list].sort((a, b) => byCost(a) - byCost(b));
    },
    [sortMode],
  );

  // Build pharmacy options — from server for auth, computed from offers for guests
  const filteredOptions = useMemo(() => {
    const serverOptions = basket.pharmacyOptions ?? [];
    if (serverOptions.length > 0) {
      return sortOptions(
        serverOptions.filter((o) => (o.enoughQuantityMedicinesCount ?? 0) > 0),
      );
    }

    // Guest mode: compute pharmacy options from medicine.offers
    if (cartItems.length === 0 || Object.keys(medicineMap).length === 0) return [];

    const pharmacyData: Record<string, {
      title: string;
      items: ApiBasketPharmacyItem[];
      totalCost: number;
      found: number;
      enough: number;
    }> = {};

    for (const cartItem of cartItems) {
      const med = medicineMap[cartItem.medicineId];
      if (!med?.offers) continue;
      for (const offer of med.offers) {
        if (!pharmacyData[offer.pharmacyId]) {
          pharmacyData[offer.pharmacyId] = { title: offer.pharmacyTitle ?? "", items: [], totalCost: 0, found: 0, enough: 0 };
        }
        const pd = pharmacyData[offer.pharmacyId];
        const hasEnough = offer.stockQuantity >= cartItem.quantity;
        const isFound = offer.stockQuantity > 0;
        pd.items.push({
          medicineId: cartItem.medicineId,
          requestedQuantity: cartItem.quantity,
          isFound,
          foundQuantity: offer.stockQuantity,
          hasEnoughQuantity: hasEnough,
          price: offer.price,
        });
        pd.totalCost += offer.price * cartItem.quantity;
        if (isFound) pd.found++;
        if (hasEnough) pd.enough++;
      }
    }

    const guestOptions = Object.entries(pharmacyData)
      .filter(([, d]) => d.enough > 0)
      .map(([phId, d]) => {
        const geo = pharmacyGeo[phId];
        return {
          pharmacyId: phId,
          pharmacyTitle: geo?.title ?? d.title ?? "Аптека",
          totalCost: d.totalCost,
          foundMedicinesCount: d.found,
          enoughQuantityMedicinesCount: d.enough,
          totalMedicinesCount: cartItems.length,
          items: d.items,
        } as ApiBasketPharmacyOption;
      });
    return sortOptions(guestOptions);
  }, [basket.pharmacyOptions, cartItems, medicineMap, pharmacyGeo, sortOptions]);

  // Delivery cost per pharmacy — only computed in delivery mode when the
  // user has saved a destination with coords. Results stream in async;
  // cards show a skeleton while state === "loading". Declared before the
  // map-markers memo below so markers can fold delivery into their cost chip.
  const pharmacyIdsForDelivery = useMemo(
    () => filteredOptions.map((o) => o.pharmacyId),
    [filteredOptions],
  );
  const deliveryCosts = usePharmacyDeliveryCosts(
    pharmacyIdsForDelivery,
    deliveryCoords,
    deliveryAddress,
    !isPickup,
  );

  // Map markers — show all pharmacies with coordinates, add total cost if
  // available. In delivery mode the chip shows items + Jura delivery summed
  // (same figure as the sidebar card). In pickup mode, delivery is zero and
  // never shown — the chip mirrors the items subtotal only.
  // Prefer the Jura-resolved address for the marker popup (falls back to the
  // stored address — usually a Plus Code — until the lookup completes).
  const mapMarkers = useMemo(() => {
    const costMap: Record<string, number | undefined> = {};
    for (const o of filteredOptions) {
      const items = availableItemsTotal(o.items);
      const delivery = !isPickup && deliveryCosts[o.pharmacyId]?.state === "ready"
        ? (deliveryCosts[o.pharmacyId] as { cost: number }).cost
        : 0;
      costMap[o.pharmacyId] = items + delivery;
    }

    return pharmacies
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({
        id: p.id,
        title: p.title,
        address: resolvedAddresses[p.id] ?? p.address,
        lat: p.latitude!,
        lng: p.longitude!,
        iconUrl: p.iconUrl,
        cost: costMap[p.id],
      }));
  }, [pharmacies, filteredOptions, resolvedAddresses, isPickup, deliveryCosts]);

  // Scroll to pharmacy on map click
  const handlePharmacyMapClick = useCallback((id: string) => {
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(""), 2000);
  }, []);

  // Select pharmacy — final per-position selection happens on checkout page.
  // Auth is gated *here* (not on checkout) so guests land on /checkout already
  // signed in. The draft is stashed before redirecting; StoreProvider merges
  // the guest cart into the server basket on login, so the draft's pharmacy +
  // items match up when the user returns.
  function onSelectPharmacy(option: ApiBasketPharmacyOption) {
    setDraft({
      pharmacyId: option.pharmacyId,
      selectedPharmacyTitle: option.pharmacyTitle ?? "",
      selectedPharmacyItems: option.items ?? [],
      selectedPharmacyTotalCost: option.totalCost ?? 0,
      ignoredPositionIds: [],
      isPickup,
    });
    if (!token) {
      setGuestCheckoutIntent();
      router.push("/login?redirect=/checkout");
      return;
    }
    router.push("/checkout");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    // h-[100dvh] (dynamic viewport) instead of h-screen so iOS Safari's
    // retractable URL bar doesn't crop the bottom of the layout when
    // it's expanded. h-screen is kept first as a fallback for browsers
    // without dvh support.
    <div className="h-screen h-[100dvh] flex flex-col bg-surface">
      {/* Global header — search, address, cart, account */}
      <GlobalTopBar />

      {/* Sub-header: back + title + delivery/pickup tabs */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 shadow-glass bg-surface flex-shrink-0">
        <IconButton
          icon="back"
          variant="neutral"
          size="md"
          onClick={goBack}
          aria-label="Назад"
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-full bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => setIsPickup(false)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              !isPickup
                ? "bg-primary text-white shadow-card"
                : "text-on-surface-variant"
            }`}
          >
            <Icon name="truck" size={14} />
            Доставка
          </button>
          <button
            type="button"
            onClick={() => setIsPickup(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              isPickup
                ? "bg-primary text-white shadow-card"
                : "text-on-surface-variant"
            }`}
          >
            <Icon name="store" size={14} />
            Самовывоз
          </button>
        </div>

        <h1 className="ml-auto hidden text-sm font-bold text-on-surface sm:block">Выберите аптеку</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left panel — sort chips + list. Fully collapses (w-0 / h-0) and
            hands over to a floating "expand" button on the map side when
            collapsed, so the map takes the full space. */}
        <aside
          className={`flex flex-col bg-surface-container-low/50 order-2 md:order-1 overflow-hidden transition-[width,max-height,opacity,transform] duration-300 ease-in-out flex-shrink-0 ${
            isPanelCollapsed
              ? "md:w-0 md:-translate-x-2 md:max-h-none max-h-0 -translate-y-2 opacity-0 pointer-events-none w-full"
              : "md:w-[420px] lg:w-[460px] max-h-[60vh] md:max-h-none translate-x-0 translate-y-0 opacity-100 w-full"
          }`}
          aria-hidden={isPanelCollapsed}
        >
          {/* Header: sort chips + collapse toggle. Horizontal-scroll strip so
              chips never get hidden behind the toggle on narrow phones. */}
          <div className="flex items-center gap-1.5 border-b border-outline/50 bg-surface-container-low/80 px-3 py-2 sticky top-0 z-10">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-touch">
              <button
                type="button"
                onClick={() => setSortMode("cheapest")}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  sortMode === "cheapest"
                    ? "bg-primary text-white shadow-card"
                    : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Самая низкая цена
              </button>
              <button
                type="button"
                onClick={() => setSortMode("most-positions")}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  sortMode === "most-positions"
                    ? "bg-primary text-white shadow-card"
                    : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Больше позиций
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(true)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-card transition hover:bg-surface-container-high active:scale-95"
              aria-label="Скрыть список аптек"
              title="Скрыть список"
            >
              <Icon name="chevron-up" size={16} className="md:hidden" />
              <Icon name="chevron-left" size={16} className="hidden md:block" />
            </button>
          </div>

          {/* Cards list */}
          <div className="flex-1 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">
              Нет доступных аптек для вашей корзины.
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {filteredOptions.map((option) => {
                const geo = pharmacyGeo[option.pharmacyId];
                const resolvedAddress =
                  resolvedAddresses[option.pharmacyId] ?? geo?.address;
                const isHighlighted = highlightedId === option.pharmacyId;
                const isExpanded = expandedId === option.pharmacyId;
                const allAvailable = (option.enoughQuantityMedicinesCount ?? 0) >= (option.totalMedicinesCount ?? 1);

                const pickup = isPickup
                  ? getPickupAvailability(geo?.opensAt, geo?.closesAt)
                  : null;
                const delivery = !isPickup ? deliveryCosts[option.pharmacyId] : undefined;

                return (
                  <div
                    key={option.pharmacyId}
                    ref={(el) => { cardRefs.current[option.pharmacyId] = el; }}
                    className={`rounded-3xl bg-surface-container-lowest p-4 shadow-card transition ${
                      isHighlighted ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {/* Pharmacy header */}
                    <div className="flex items-start gap-3">
                      <PharmacyLogo
                        pharmacyId={option.pharmacyId}
                        iconUrl={geo?.iconUrl}
                        size={44}
                        className="flex-shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-on-surface">{option.pharmacyTitle ?? "Аптека"}</h3>
                        {resolvedAddress ? (
                          <p className="truncate text-xs text-on-surface-variant">{resolvedAddress}</p>
                        ) : null}
                        {pickup ? (
                          <p
                            className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${
                              pickup.canPickupToday ? "text-primary" : "text-on-surface-variant"
                            }`}
                          >
                            <Icon name="clock" size={12} />
                            <span className="truncate">{pickup.hoursHint}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Price + availability + actions */}
                    {(() => {
                      const availableTotal = (option.items ?? [])
                        .filter((i) => i.hasEnoughQuantity)
                        .reduce((sum, i) => sum + (i.price ?? 0) * i.requestedQuantity, 0);
                      const deliveryCost =
                        delivery?.state === "ready" ? delivery.cost : 0;
                      const grandTotal = availableTotal + deliveryCost;
                      return (
                        <div className="mt-3 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-display text-xl font-extrabold text-primary tabular-nums">
                              {formatMoney(grandTotal)}
                            </p>
                            {!isPickup ? (
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-on-surface-variant tabular-nums">
                                <span>Товары: {formatMoney(availableTotal)}</span>
                                {delivery?.state === "ready" ? (
                                  <span>
                                    + Доставка: <span className="font-semibold text-on-surface">{formatMoney(delivery.cost)}</span>
                                    {delivery.distance > 0 ? (
                                      <span className="text-on-surface-variant/70"> · {delivery.distance.toFixed(1)} км</span>
                                    ) : null}
                                  </span>
                                ) : delivery?.state === "loading" ? (
                                  <span className="text-on-surface-variant/70">+ Доставка…</span>
                                ) : delivery?.state === "error" ? (
                                  <span className="text-warning">+ Доставка: ошибка расчёта</span>
                                ) : (
                                  <span className="text-on-surface-variant/70">+ Доставка</span>
                                )}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? "" : option.pharmacyId)}
                              className="mt-1 flex items-center gap-1 text-xs font-semibold transition hover:text-primary"
                            >
                              {allAvailable ? (
                                <Chip tone="success" asButton={false} size="sm" leftIcon="check">Всё в наличии</Chip>
                              ) : (
                                <Chip tone="warning" asButton={false} size="sm">
                                  {option.enoughQuantityMedicinesCount ?? 0} из {option.totalMedicinesCount ?? 0}
                                </Chip>
                              )}
                              <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={14} className="text-on-surface-variant" />
                            </button>
                          </div>

                          <Button
                            size="md"
                            rightIcon="arrow-right"
                            onClick={() => onSelectPharmacy(option as ApiBasketPharmacyOption)}
                          >
                            {pickup ? pickup.buttonText : "Выбрать"}
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Expanded items list */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2 border-t border-surface-container-high pt-3">
                        {(option.items ?? []).map((item) => {
                          const med = medicineMap[item.medicineId];
                          const name = med ? getMedicineDisplayName(med) : item.medicineId;
                          const imgUrl = med ? resolveMedicineImageUrl(med, 120) : "";

                          const enough = item.hasEnoughQuantity;
                          const partial = item.isFound && !enough;
                          const missing = !item.isFound;
                          const cappedFound = Math.min(item.foundQuantity, item.requestedQuantity);
                          return (
                            <div key={item.medicineId} className={`flex items-center gap-2.5 text-xs ${missing ? "opacity-50" : ""}`}>
                              {imgUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imgUrl} alt="" className="w-8 h-8 rounded object-contain bg-surface-container-low flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-surface-container-low flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{name}</p>
                                {missing ? (
                                  <p className="text-[10px] text-red-500">Нет в наличии</p>
                                ) : partial ? (
                                  <p className="text-[10px] text-amber-600">Доступно только {item.foundQuantity} из {item.requestedQuantity}</p>
                                ) : null}
                              </div>
                              <span className={`flex-shrink-0 tabular-nums ${enough ? "text-on-surface-variant" : "text-amber-600 font-semibold"}`}>
                                {cappedFound}/{item.requestedQuantity}
                              </span>
                              <span className={`font-bold flex-shrink-0 ${missing ? "line-through text-on-surface-variant" : ""}`}>
                                {formatMoney(item.price ?? 0, "TJS")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </aside>

        {/* Right panel — map. On mobile the map normally reserves 40vh so the
            cards list sits below; when the panel collapses it grabs the full
            remaining viewport. */}
        <div
          className={`relative order-1 md:order-2 md:h-auto transition-[height] duration-300 ${
            isPanelCollapsed ? "flex-1 h-full" : "h-[40vh] md:flex-1"
          }`}
        >
          <PharmacyMap
            className="h-full w-full"
            pharmacies={mapMarkers}
            onPharmacyClick={handlePharmacyMapClick}
            userLocation={deliveryCoords}
          />

          {/* Floating "expand" button — appears only while the sidebar is
              collapsed. Desktop pins it to left edge, mobile to bottom edge,
              positioning the chevron toward where the panel will emerge. */}
          {isPanelCollapsed ? (
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(false)}
              aria-label="Показать список аптек"
              title="Показать список аптек"
              className="absolute z-20 flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-2 font-display text-xs font-extrabold text-on-surface shadow-float transition hover:bg-surface-container-high active:scale-95 safe-bottom
                left-3 bottom-4 md:top-3 md:bottom-auto"
            >
              <Icon name="chevron-up" size={16} className="md:hidden" />
              <Icon name="chevron-right" size={16} className="hidden md:block" />
              <span>Список аптек</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
