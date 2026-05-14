"use client";

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useGoBack } from "@/shared/lib/useNavigationHistory";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import { getGuestBasketPreview } from "@/entities/basket/api";
import {
  getMyPrescriptions,
  getPrescriptionPharmacyOptions,
  type ApiPrescription,
  type ApiPrescriptionPharmacyOption,
} from "@/entities/prescription/api";
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
import { ProductModal } from "@/widgets/product/ProductModal";
import { Button, Chip, Icon, IconButton, PharmacyLogo } from "@/shared/ui";
import dynamic from "next/dynamic";

type PharmacySort = "cheapest" | "most-positions";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

/** Map prescription-side pharmacy option to the basket-side shape this
 *  page already understands. Manual lookup items contribute their
 *  per-pharmacy shadow medicineId so explicit checkout (Source.Positions)
 *  can submit them as ordinary entries. Items the pharmacy can't fulfil
 *  (no resolved medicineId) are dropped — the cart-style row needs an id
 *  to render and to add to the order. */
function adaptPrescriptionPharmacyOption(
  p: ApiPrescriptionPharmacyOption,
): ApiBasketPharmacyOption {
  return {
    pharmacyId: p.pharmacyId,
    pharmacyTitle: p.pharmacyTitle,
    pharmacyIsActive: p.pharmacyIsActive,
    isAvailable: p.isAvailable,
    totalCost: p.totalCost,
    foundMedicinesCount: p.foundItemsCount,
    totalMedicinesCount: p.totalItemsCount,
    enoughQuantityMedicinesCount: p.enoughQuantityItemsCount,
    foundMedicinesRatio: `${p.foundItemsCount}/${p.totalItemsCount}`,
    items: p.items
      .filter((i) => !!i.medicineId)
      .map((i) => ({
        medicineId: i.medicineId!,
        requestedQuantity: i.requestedQuantity,
        isFound: i.isFound,
        foundQuantity: i.foundQuantity,
        hasEnoughQuantity: i.hasEnoughQuantity,
        price: i.price ?? null,
        useUnitMode: i.useUnitMode ?? false,
        unitCount: i.unitCount ?? null,
        unitTotalPrice: i.unitTotalPrice ?? null,
      })),
  };
}

export default function PharmacySelectPage() {
  // useSearchParams must live under a Suspense boundary for static export
  // to work. Inner component holds the actual page logic.
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <PharmacySelectPageInner />
    </Suspense>
  );
}

function PharmacySelectPageInner() {
  const token = useAppSelector((s) => s.auth.token);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const goBack = useGoBack();

  // Push `?product={slug-or-id}` so the global ProductModal opens on top of
  // the current page — same UX as clicking a card in the catalog. Skip the
  // call if the same product is already open.
  const openProductModal = useCallback((med: ApiMedicine | undefined, fallbackId: string) => {
    const key = med?.slug || med?.id || fallbackId;
    if (!key) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("product") === key) return;
    const wasOpen = params.has("product");
    params.set("product", key);
    const url = `${pathname}?${params.toString()}`;
    if (wasOpen) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [pathname, router, searchParams]);

  const { basket, loadBasket } = useCartStore();
  const guestItems = useGuestCartStore((s) => s.items);
  const setDraft = useCheckoutDraftStore((s) => s.setDraft);
  const deliveryCoords = useDeliveryAddressStore((s) => s.coords);

  // Prescription mode — when this URL carries `?prescription={id}` the page
  // operates on the prescription's items, NOT the basket. Pharmacy options
  // are computed via the guest-preview endpoint over the explicit positions
  // (the basket is never read or mutated). On selection we stash
  // prescriptionId in the checkout draft so /checkout posts with
  // Source.Kind=Explicit + Source.PrescriptionId.
  //
  // Defensive read: useSearchParams sometimes returns an empty bag during
  // the very first client render after a hard reload (Next.js streaming
  // hydration). Falling back to window.location.search ensures the mode
  // is detected on the synchronous first pass — without this, the
  // pharmacy picker would briefly mount in basket mode and fire
  // loadBasket() before the searchParams hook caught up.
  const searchPrescriptionId = searchParams.get("prescription") ?? "";
  const prescriptionId = useMemo(() => {
    if (searchPrescriptionId) return searchPrescriptionId;
    if (typeof window === "undefined") return "";
    try {
      return new URLSearchParams(window.location.search).get("prescription") ?? "";
    } catch {
      return "";
    }
  }, [searchPrescriptionId]);
  const prescriptionMode = !!prescriptionId;

  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [medicineMap, setMedicineMap] = useState<Record<string, ApiMedicine>>({});
  const [expandedId, setExpandedId] = useState<string>("");
  const [highlightedId, setHighlightedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPickup, setIsPickup] = useState(false);
  const [sortMode, setSortMode] = useState<PharmacySort>("cheapest");
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<Array<{ medicineId: string; quantity: number }>>([]);
  const [prescriptionOptions, setPrescriptionOptions] = useState<ApiBasketPharmacyOption[]>([]);
  const [prescription, setPrescription] = useState<ApiPrescription | null>(null);

  const resolvedAddresses = usePharmacyAddresses(pharmacies);
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Imperative handle from the map — lets the page panTo a coord (when
  // the user clicks "show on map" on a pharmacy card) and reset the
  // viewport to Dushanbe-wide framing (fit-to-city floating button).
  const mapHandleRef = useRef<import("@/widgets/map/PharmacyMap").PharmacyMapHandle | null>(null);

  // Cart items — server for auth, guest for unauth, OR prescription items
  // when we're in prescription-checkout mode (basket is intentionally
  // ignored so the user's regular cart stays untouched).
  const cartItems = useMemo(() => {
    if (prescriptionMode) return prescriptionItems;
    if (token && (basket.positions ?? []).length > 0) {
      return (basket.positions ?? []).map((p) => ({ medicineId: p.medicineId, quantity: p.quantity }));
    }
    return guestItems;
  }, [prescriptionMode, prescriptionItems, token, basket.positions, guestItems]);

  // Load data — pharmacies always; basket only in regular mode; prescription
  // + its computed pharmacy options only in prescription mode.
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const pharmsPromise = getActivePharmacies();
        if (prescriptionMode && token) {
          // Resolve the prescription from the client's own list, then derive
          // (medicineId, quantity) drafts. Manual checklist entries (no
          // medicineId) are skipped — they can't be ordered through the
          // regular catalog flow.
          const [pharms, all] = await Promise.all([
            pharmsPromise,
            getMyPrescriptions(token).catch(() => [] as ApiPrescription[]),
          ]);
          setPharmacies(pharms);
          const found = all.find((p) => p.prescriptionId === prescriptionId) ?? null;
          setPrescription(found);
          // Pull client-edited quantity overrides AND pair selections from
          // the prescription detail page. Both live in localStorage so
          // edits survive tab close. Reads the legacy sessionStorage qty
          // row first so users mid-flight from an older build don't lose
          // their edits.
          let overrides: Record<string, number> = {};
          let pairSel: Record<string, string> = {};
          try {
            const qtyKey = `yalla.prescription.qty.${prescriptionId}`;
            const rawQty = localStorage.getItem(qtyKey) ?? sessionStorage.getItem(qtyKey);
            if (rawQty) overrides = JSON.parse(rawQty);
            const rawPair = localStorage.getItem(`yalla.prescription.pair.${prescriptionId}`);
            if (rawPair) pairSel = JSON.parse(rawPair);
          } catch { /* ignore */ }

          // Resolve pairs to a single chosen-side entry. Default selection
          // = analog. The original is hidden when the analog is chosen
          // (and vice-versa). Mirrors the backend's MoveChecklistToCart
          // logic so explicit-checkout (this path) and basket-flow agree.
          const allItems = found?.items ?? [];
          const itemsById = new Map(allItems.map((i) => [i.id, i]));
          const analogIds = new Set(allItems.filter((i) => i.analogItemId).map((i) => i.analogItemId as string));
          const drafts: Array<{ medicineId: string; quantity: number }> = [];
          for (const it of allItems) {
            if (analogIds.has(it.id)) continue; // counted via pair-original
            let chosen = it;
            if (it.analogItemId) {
              const analog = itemsById.get(it.analogItemId);
              if (analog) {
                const pickedId = pairSel[it.id];
                const preferAnalog = pickedId !== it.id;
                const candidate = preferAnalog ? analog : it;
                const fallback = preferAnalog ? it : analog;
                const candidateQty = candidate.id in overrides ? overrides[candidate.id] : candidate.quantity;
                if (candidate.medicineId && candidateQty > 0) {
                  chosen = candidate;
                } else {
                  const fallbackQty = fallback.id in overrides ? overrides[fallback.id] : fallback.quantity;
                  if (fallback.medicineId && fallbackQty > 0) chosen = fallback;
                  else continue;
                }
              }
            }
            if (!chosen.medicineId) continue;
            const qty = chosen.id in overrides ? overrides[chosen.id] : chosen.quantity;
            if (qty <= 0) continue;
            drafts.push({ medicineId: chosen.medicineId, quantity: qty });
          }
          setPrescriptionItems(drafts);
          // Use the prescription-aware pharmacy-options endpoint instead
          // of the generic basket preview — it resolves manual lookup
          // items via shadow medicines server-side, so a pharmacy that
          // only answered the manual lookup still shows up in the
          // picker with the right coverage and total.
          const presOpts = await getPrescriptionPharmacyOptions(token, prescriptionId)
            .catch(() => null);
          if (presOpts && presOpts.pharmacyOptions.length > 0) {
            setPrescriptionOptions(presOpts.pharmacyOptions.map(adaptPrescriptionPharmacyOption));
          } else if (drafts.length > 0) {
            // Fallback: if the prescription endpoint failed (e.g. no
            // checklist yet), fall back to the catalog-only preview so
            // the page still renders something usable.
            const opts = await getGuestBasketPreview(drafts).catch(() => [] as ApiBasketPharmacyOption[]);
            setPrescriptionOptions(opts);
          } else {
            setPrescriptionOptions([]);
          }
        } else {
          const [pharms] = await Promise.all([
            pharmsPromise,
            token ? loadBasket(token) : Promise.resolve(),
          ]);
          setPharmacies(pharms);
        }
      } catch { /* ignore */ }
      setIsLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadBasket, prescriptionMode, prescriptionId]);

  // Load medicine details for items in cart AND for any extra medicineIds
  // surfaced in the prescription pharmacy options. Shadow medicines
  // materialised from manual lookup responses live only in the per-pharmacy
  // option lists (they're never in the catalog/basket) — without including
  // them here the rendered cart row falls back to displaying the raw id
  // instead of the pharmacy's "FullName".
  useEffect(() => {
    const cartIds = cartItems.map((i) => i.medicineId);
    const pharmacyOptionIds = prescriptionOptions.flatMap((opt) =>
      (opt.items ?? []).map((i) => i.medicineId).filter((id): id is string => !!id),
    );
    const allIds = Array.from(new Set([...cartIds, ...pharmacyOptionIds]))
      .filter((id) => !medicineMap[id]);
    if (allIds.length === 0) return;
    Promise.all(allIds.map((id) => getMedicineById(id).catch(() => null))).then((results) => {
      const map: Record<string, ApiMedicine> = { ...medicineMap };
      for (const m of results) {
        if (m?.id) map[m.id] = m;
      }
      setMedicineMap(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, prescriptionOptions]);

  // Build pharmacy geo lookup
  const pharmacyGeo = useMemo(() => {
    const map: Record<string, ActivePharmacy> = {};
    for (const p of pharmacies) map[p.id] = p;
    return map;
  }, [pharmacies]);

  // Sum across in-stock-at-required-qty items only. Unit-mode rows
  // contribute the pharmacist's `unitTotalPrice` flat — the pack count
  // (`requestedQuantity`) is only there for the stock check, not for
  // pricing.
  function availableItemsTotal(items: ApiBasketPharmacyItem[] | undefined) {
    return (items ?? [])
      .filter((i) => i.hasEnoughQuantity)
      .reduce((sum, i) => {
        if (i.useUnitMode && i.unitTotalPrice != null) return sum + i.unitTotalPrice;
        return sum + (i.price ?? 0) * i.requestedQuantity;
      }, 0);
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

  // Build pharmacy options — from server for auth, computed from offers for
  // guests, OR from /api/basket/guest-preview for prescription mode.
  const filteredOptions = useMemo(() => {
    if (prescriptionMode) {
      return sortOptions(
        prescriptionOptions.filter((o) => (o.enoughQuantityMedicinesCount ?? 0) > 0),
      );
    }
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
  }, [prescriptionMode, prescriptionOptions, basket.pharmacyOptions, cartItems, medicineMap, pharmacyGeo, sortOptions]);

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

  // Tap on a map marker → make sure the side panel is open, expand
  // that pharmacy's card so the user sees its item rows immediately,
  // scroll the card into view, and highlight it briefly.
  //
  // The panel's open/close animation runs for 300 ms
  // (transition-transform duration-300 on the <aside>). If we
  // scrollIntoView before that's done, the card's bounding box is
  // still off-screen on phones (panel slides up from below) so the
  // scroll lands on an element that's mid-flight. Wait out the full
  // animation + one rAF for layout to settle, then scroll.
  const handlePharmacyMapClick = useCallback((id: string) => {
    setIsPanelCollapsed(false);
    setExpandedId(id);
    setHighlightedId(id);

    const scrollWhenReady = () => {
      const el = cardRefs.current[id];
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    // 350 ms = panel slide-in (300) + a buffer for the card's own
    // expand animation. If the panel was already open, the extra
    // wait is invisible (smooth-scroll itself takes ~300 ms anyway).
    window.setTimeout(scrollWhenReady, 350);

    // Highlight long enough that the user's eye catches it even
    // when they look back at the panel after dismissing the marker
    // tooltip on mobile.
    setTimeout(() => setHighlightedId(""), 2500);
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
      // Carry the prescriptionId through the draft so /checkout knows to
      // submit with Source.Kind=Explicit and Source.PrescriptionId. Cleared
      // in regular cart-flow selections (default null in initialState).
      prescriptionId: prescriptionMode ? prescriptionId : null,
    });
    if (!token) {
      setGuestCheckoutIntent();
      router.push(`/login?redirect=${encodeURIComponent(prescriptionMode ? `/checkout?prescription=${prescriptionId}` : "/checkout")}`);
      return;
    }
    router.push(prescriptionMode ? `/checkout?prescription=${encodeURIComponent(prescriptionId)}` : "/checkout");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    // Triple fallback: legacy h-screen (= 100vh) for browsers that
    // don't know either viewport unit; 100dvh for dynamic adaptation
    // when iOS Safari's URL bar collapses/expands; 100svh as the
    // safest floor — always equal to the smallest viewport the user
    // will see, so action buttons never end up under Safari's
    // bottom toolbar.
    <div className="h-screen h-[100dvh] h-svh flex flex-col bg-surface">
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
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-[0.97] ${
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
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-[0.97] ${
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

      {/* Main content — map fills the whole area, pharmacy panel slides in
          on top of it as an absolute overlay. The map element itself never
          resizes regardless of panel state, so Google Maps doesn't trigger
          a relayout / re-tile / "shake" each time the user toggles the
          list on or off. */}
      <div className="flex-1 overflow-hidden relative">
        {/* Pharmacy panel — absolute overlay. Phone: docked to the bottom
            edge, slides down off-screen when collapsed. Desktop (md+):
            docked to the left edge full-height, slides off to the left.
            translate-X/Y handles the open/close so layout never reflows.
            pointer-events-none only after it slides off so the map below
            stays interactive without click-stealing. */}
        <aside
          className={`absolute z-30 flex flex-col bg-surface-container-low overflow-hidden shadow-glass transition-transform duration-300 ease-in-out
            inset-x-0 bottom-0 max-h-full rounded-t-2xl
            md:inset-y-0 md:left-0 md:right-auto md:w-[420px] md:rounded-t-none lg:w-[460px]
            ${isPanelCollapsed
              ? "translate-y-full md:-translate-x-full md:translate-y-0 pointer-events-none"
              : "translate-y-0"
            }`}
          aria-hidden={isPanelCollapsed}
        >
          {/* Header: sort chips + collapse toggle. Horizontal-scroll strip so
              chips never get hidden behind the toggle on narrow phones. */}
          <div className="flex items-center gap-1.5 border-b border-outline/50 bg-surface-container-low/80 px-3 py-2 flex-shrink-0">
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
              {/* Chevron points in the direction the panel will move on
                  click — down on phones (panel slides down to reveal the
                  map) and left on desktop (panel slides off-screen left).
                  The previous "up" arrow read as "expand panel" which is
                  the opposite of what the click does. */}
              <Icon name="chevron-down" size={16} className="md:hidden" />
              <Icon name="chevron-left" size={16} className="hidden md:block" />
            </button>
          </div>

          {/* Cards list — bottom padding stacks fixed pb-32 (8rem) on top of
              env(safe-area-inset-bottom) so the iPhone home indicator and any
              browser UI overlap (collapsing URL bar) never clip the LAST
              pharmacy card / its expanded item rows. The earlier pb-24 was
              just enough on average phones but routinely cut a row off on
              shorter / split-screen sessions.

              `min-h-0` is what makes the inner overflow-y-auto actually
              scroll — without it, this flex-1 child grows past the aside's
              clipped height and the bottom cards spill off the screen
              with no scrollbar to recover them. */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {filteredOptions.length === 0 ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">
              Нет доступных аптек для вашей корзины.
            </div>
          ) : (
            <div className="space-y-2 p-3 pb-32 [padding-bottom:calc(8rem+env(safe-area-inset-bottom))]">
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
                    // `scroll-mt-12` gives scrollIntoView a top breathing
                    // room so the matched card never lands hugging the
                    // sticky header. Highlight: thicker ring + brief
                    // ripple pulse via .pharmacy-card-pulse so a
                    // marker-driven reveal really catches the eye, even
                    // when the user looks back after dismissing the
                    // tooltip on the map.
                    className={`scroll-mt-12 rounded-3xl bg-surface-container-lowest p-4 shadow-card transition-all duration-300 ${
                      isHighlighted ? "ring-4 ring-primary shadow-float scale-[1.015] pharmacy-card-pulse" : ""
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
                      const availableTotal = availableItemsTotal(option.items);
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
                            {/* Stock chip + map + expand chevron. Three roles,
                                three controls — each affordance does exactly
                                one thing:
                                  • Chip: passive status label (no click).
                                  • Map: centre the map and pulse the marker;
                                    does NOT open the items list.
                                  • Chevron: toggles the items list. */}
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex">
                                {allAvailable ? (
                                  <Chip tone="success" asButton={false} size="sm" leftIcon="check">Всё в наличии</Chip>
                                ) : (
                                  <Chip tone="warning" asButton={false} size="sm">
                                    {option.enoughQuantityMedicinesCount ?? 0} из {option.totalMedicinesCount ?? 0}
                                  </Chip>
                                )}
                              </span>
                              {/* Expand toggle — single-purpose chevron that
                                  flips when the items list is open so the
                                  user can predict what happens on click. */}
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? "" : option.pharmacyId)}
                                aria-label={isExpanded ? "Скрыть позиции" : "Показать позиции"}
                                title={isExpanded ? "Скрыть позиции" : "Показать позиции"}
                                aria-expanded={isExpanded}
                                className={`flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition hover:bg-primary/10 hover:text-primary active:scale-95 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              >
                                <Icon name="chevron-down" size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  // Centre the map + pulse the marker.
                                  // Crucially: do NOT toggle expand or
                                  // highlight the card — this button is
                                  // exclusively about the *marker*.
                                  const geo = pharmacyGeo[option.pharmacyId];
                                  if (geo?.latitude != null && geo?.longitude != null) {
                                    mapHandleRef.current?.panTo({ lat: geo.latitude, lng: geo.longitude });
                                  }
                                  // Map's pan animation is ~300 ms; trigger
                                  // the marker pulse after that so the user
                                  // sees the highlight on the centred view,
                                  // not on a marker mid-flight off-screen.
                                  window.setTimeout(() => {
                                    mapHandleRef.current?.highlightPharmacy(option.pharmacyId);
                                  }, 320);
                                }}
                                aria-label="Показать аптеку на карте"
                                title="Показать на карте"
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition hover:bg-primary/10 hover:text-primary active:scale-95"
                              >
                                <Icon name="map" size={14} />
                              </button>
                            </div>
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
                          const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";

                          const enough = item.hasEnoughQuantity;
                          const partial = item.isFound && !enough;
                          const missing = !item.isFound;
                          const cappedFound = Math.min(item.foundQuantity, item.requestedQuantity);
                          const inUnitMode = item.useUnitMode === true && item.unitTotalPrice != null;
                          return (
                            <button
                              key={item.medicineId}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openProductModal(med, item.medicineId); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg p-1 text-left text-xs transition active:scale-95 hover:bg-surface-container-low ${missing ? "opacity-50" : ""}`}
                            >
                              {imgUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imgUrl} alt="" className="w-8 h-8 rounded object-contain bg-surface-container-high mix-blend-multiply flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-surface-container-high flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {name}
                                  {inUnitMode ? (
                                    <span className="ml-1 rounded-full bg-accent-sun/30 px-1 py-0 text-[9px] font-bold text-accent-sun-ink">
                                      поштучно
                                    </span>
                                  ) : null}
                                </p>
                                {missing ? (
                                  <p className="text-[10px] text-red-500">Нет в наличии</p>
                                ) : partial ? (
                                  <p className="text-[10px] text-amber-600">Доступно только {item.foundQuantity} из {item.requestedQuantity}</p>
                                ) : null}
                              </div>
                              <span className={`flex-shrink-0 tabular-nums ${enough ? "text-on-surface-variant" : "text-amber-600 font-semibold"}`}>
                                {inUnitMode
                                  ? `${item.unitCount ?? 0} шт.`
                                  : `${cappedFound}/${item.requestedQuantity}`}
                              </span>
                              <span className={`font-bold flex-shrink-0 ${missing ? "line-through text-on-surface-variant" : ""}`}>
                                {formatMoney(
                                  inUnitMode ? (item.unitTotalPrice ?? 0) : (item.price ?? 0),
                                  "TJS",
                                )}
                              </span>
                            </button>
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

        {/* Map fills the entire viewport area, identical size at all
            times — the panel slides on top of it instead of pushing it
            around, so Google Maps never sees its container resize. */}
        <div className="absolute inset-0">
          <PharmacyMap
            className="h-full w-full"
            pharmacies={mapMarkers}
            onPharmacyClick={handlePharmacyMapClick}
            userLocation={deliveryCoords}
            mapHandle={(handle) => { mapHandleRef.current = handle; }}
          />

          {/* Floating "expand" button — visible while the sidebar is
              collapsed. Position depends on which side the panel emerges
              from: phone (panel slides up from below) → button at
              top-right of the map; md+ (panel docks to the left) →
              button at top-left so it sits just outside the panel slot.
              Chevron icon mirrors the gesture too. */}
          {isPanelCollapsed ? (
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(false)}
              aria-label="Показать список аптек"
              title="Показать список аптек"
              className="absolute z-20 flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-2 font-display text-xs font-extrabold text-on-surface shadow-float transition hover:bg-surface-container-high active:scale-95
                right-3 top-3 md:left-3 md:right-auto"
            >
              {/* Chevron points in the direction the panel will move on
                  click — up on phones (panel rises from the bottom) and
                  right on desktop (panel slides in from the left). */}
              <Icon name="chevron-up" size={16} className="md:hidden" />
              <Icon name="chevron-right" size={16} className="hidden md:block" />
              <span>Список аптек</span>
            </button>
          ) : null}

          {/* "Fit to Dushanbe" — resets the viewport to the city-wide
              framing (every pharmacy + user location fit at once).
              Placed at the bottom-right of the map so it doesn't fight
              with Yandex's own attribution at the top-right or the
              panel-collapse chevron at top-left/right. */}
          <button
            type="button"
            onClick={() => mapHandleRef.current?.fitDushanbe()}
            aria-label="Показать весь Душанбе"
            title="Показать весь Душанбе"
            className="absolute bottom-4 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-float transition hover:bg-surface-container-high active:scale-95"
          >
            <Icon name="map" size={20} />
          </button>
        </div>
      </div>

      {/* Global product modal — opens when `?product={key}` is in the URL.
          Mounted here too so position rows on this page can pop the modal
          without leaving the pharmacy selection flow. */}
      <ProductModal />
    </div>
  );
}
