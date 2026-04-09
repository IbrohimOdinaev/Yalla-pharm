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

import { GlobalTopBar } from "@/widgets/layout/GlobalTopBar";
import dynamic from "next/dynamic";

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

  // Build pharmacy options — from server for auth, computed from offers for guests
  const filteredOptions = useMemo(() => {
    const serverOptions = basket.pharmacyOptions ?? [];
    if (serverOptions.length > 0) {
      return serverOptions
        .filter((o) => (o.enoughQuantityMedicinesCount ?? 0) > 0)
        .sort((a, b) => (a.totalCost ?? Infinity) - (b.totalCost ?? Infinity));
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

    return Object.entries(pharmacyData)
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
      })
      .sort((a, b) => (a.totalCost ?? Infinity) - (b.totalCost ?? Infinity));
  }, [basket.pharmacyOptions, cartItems, medicineMap, pharmacyGeo]);

  // Map markers — show all pharmacies with coordinates, add cost if available
  const mapMarkers = useMemo(() => {
    const costMap: Record<string, number | undefined> = {};
    for (const o of filteredOptions) costMap[o.pharmacyId] = o.totalCost;

    return pharmacies
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({
        id: p.id,
        title: p.title,
        address: p.address,
        lat: p.latitude!,
        lng: p.longitude!,
        iconUrl: p.iconUrl,
        cost: costMap[p.id],
      }));
  }, [pharmacies, filteredOptions]);

  // Scroll to pharmacy on map click
  const handlePharmacyMapClick = useCallback((id: string) => {
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(""), 2000);
  }, []);

  // Select pharmacy — no auth required here, auth checked on checkout confirm
  function onSelectPharmacy(option: ApiBasketPharmacyOption) {
    const unavailableMedIds = (option.items ?? [])
      .filter((i) => !i.hasEnoughQuantity)
      .map((i) => i.medicineId);
    const ignoredPositionIds = (basket.positions ?? [])
      .filter((p) => unavailableMedIds.includes(p.medicineId))
      .map((p) => p.id);

    setDraft({
      pharmacyId: option.pharmacyId,
      selectedPharmacyTitle: option.pharmacyTitle ?? "",
      selectedPharmacyItems: option.items ?? [],
      selectedPharmacyTotalCost: option.totalCost ?? 0,
      ignoredPositionIds,
      isPickup,
    });
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
    <div className="h-screen flex flex-col bg-surface">
      {/* Global header — search, address, cart, account */}
      <GlobalTopBar />

      {/* Sub-header: back + title + delivery/pickup tabs */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-surface-container-high bg-surface flex-shrink-0">
        <button type="button" onClick={() => router.push(goBack())} className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-low text-primary hover:bg-surface-container-high transition flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>

        {/* Tabs */}
        <div className="flex rounded-full bg-surface-container-low p-0.5">
          <button
            type="button"
            onClick={() => setIsPickup(false)}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${!isPickup ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            Доставка
          </button>
          <button
            type="button"
            onClick={() => setIsPickup(true)}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${isPickup ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            Самовывоз
          </button>
        </div>

        <h1 className="text-sm sm:text-base font-bold text-on-surface ml-2">Выберите аптеку</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left panel — pharmacy list */}
        <aside className="w-full md:w-[400px] lg:w-[440px] flex-shrink-0 overflow-y-auto border-r border-surface-container-high order-2 md:order-1">
          {filteredOptions.length === 0 ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">
              Нет доступных аптек для вашей корзины.
            </div>
          ) : (
            <div className="divide-y divide-surface-container-high">
              {filteredOptions.map((option) => {
                const geo = pharmacyGeo[option.pharmacyId];
                const isHighlighted = highlightedId === option.pharmacyId;
                const isExpanded = expandedId === option.pharmacyId;
                const allAvailable = (option.enoughQuantityMedicinesCount ?? 0) >= (option.totalMedicinesCount ?? 1);

                return (
                  <div
                    key={option.pharmacyId}
                    ref={(el) => { cardRefs.current[option.pharmacyId] = el; }}
                    className={`p-4 transition-colors duration-500 ${isHighlighted ? "bg-primary/5 ring-2 ring-primary/30 ring-inset" : ""}`}
                  >
                    {/* Pharmacy header */}
                    <div className="flex items-start gap-3">
                      {/* Icon — always try loading, fallback on error */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={geo?.iconUrl?.startsWith("http") ? geo.iconUrl : `/api/pharmacies/icon/${option.pharmacyId}/content`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style"); }}
                        />
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" style={{ display: "none" }}>
                          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                        </svg>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-on-surface truncate">{option.pharmacyTitle ?? "Аптека"}</h3>
                        {geo?.address ? (
                          <p className="text-xs text-on-surface-variant truncate">{geo.address}</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Price + availability + actions */}
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-lg font-extrabold text-on-surface">{formatMoney(option.totalCost ?? 0, "TJS")}</p>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? "" : option.pharmacyId)}
                          className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition mt-0.5"
                        >
                          <span className={allAvailable ? "text-emerald-600" : "text-amber-600"}>
                            {allAvailable
                              ? "Все в наличии"
                              : `${option.enoughQuantityMedicinesCount ?? 0} из ${option.totalMedicinesCount ?? 0} в наличии`}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition ${isExpanded ? "rotate-180" : ""}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectPharmacy(option as ApiBasketPharmacyOption)}
                        className="stitch-button px-5 py-2 text-sm"
                      >
                        Выбрать
                      </button>
                    </div>

                    {/* Expanded items list */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2 border-t border-surface-container-high pt-3">
                        {(option.items ?? []).map((item) => {
                          const med = medicineMap[item.medicineId];
                          const name = med ? getMedicineDisplayName(med) : item.medicineId;
                          const imgUrl = med ? resolveMedicineImageUrl(med) : "";

                          return (
                            <div key={item.medicineId} className={`flex items-center gap-2.5 text-xs ${!item.hasEnoughQuantity ? "opacity-50" : ""}`}>
                              {imgUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imgUrl} alt="" className="w-8 h-8 rounded object-contain bg-surface-container-low flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-surface-container-low flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{name}</p>
                                {!item.hasEnoughQuantity ? (
                                  <p className="text-[10px] text-red-500">Нет в наличии</p>
                                ) : null}
                              </div>
                              <span className="text-on-surface-variant flex-shrink-0">×{item.requestedQuantity}</span>
                              <span className="font-bold flex-shrink-0">{formatMoney(item.price ?? 0, "TJS")}</span>
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
        </aside>

        {/* Right panel — map */}
        <div className="flex-1 order-1 md:order-2 h-[40vh] md:h-auto">
          <PharmacyMap
            className="h-full w-full"
            pharmacies={mapMarkers}
            onPharmacyClick={handlePharmacyMapClick}
            userLocation={deliveryCoords}
          />
        </div>
      </div>
    </div>
  );
}
