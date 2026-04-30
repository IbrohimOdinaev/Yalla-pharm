"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayView, Marker } from "@react-google-maps/api";
import { env } from "@/shared/config/env";
import { DUSHANBE_CENTER, getMapProvider, type GeoPoint, type GeoResult } from "@/shared/lib/map";
import { formatMoney } from "@/shared/lib/format";

// `marker` library gives us AdvancedMarkerElement, which positions via the
// native marker layer — no transform/draw desync on drag-end (unlike
// OverlayView, which flashes markers to the old screen position for a frame
// after releasing the mouse). `mapId` is required for AdvancedMarker; using
// the public demo id is fine for dev and for maps without custom styles.
const LIBRARIES: ("places" | "marker")[] = ["places", "marker"];
const MAP_ID = "DEMO_MAP_ID";

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  rotateControl: false,
  scaleControl: false,
  // Keep keyboard shortcuts for power users (no on-screen control though).
  keyboardShortcuts: true,
  mapId: MAP_ID,
  // "greedy" lets the user pan/zoom with a single finger on mobile. Default
  // "auto" falls back to "cooperative" on touch devices (needs 2 fingers).
  gestureHandling: "greedy",
};

export type PharmacyMarker = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  iconUrl?: string | null;
  cost?: number;
};

export type PharmacyMapHandle = {
  panTo: (point: GeoPoint) => void;
};

type PharmacyMapProps = {
  pharmacies: PharmacyMarker[];
  className?: string;
  onPharmacyClick?: (id: string) => void;
  /** Legacy: click on map to pick address */
  onMapClick?: (result: GeoResult) => void;
  /** New: drag map, center pin picks address on idle */
  onCenterChange?: (result: GeoResult) => void;
  userLocation?: GeoPoint | null;
  selectedPoint?: GeoPoint | null;
  /** Legacy click-to-pick mode */
  pickMode?: boolean;
  /** New drag-to-pick mode with center pin */
  centerPinMode?: boolean;
  /** Ref callback to get imperative handle (panTo) */
  mapHandle?: (handle: PharmacyMapHandle | null) => void;
};

export function PharmacyMap({
  pharmacies,
  className = "",
  onPharmacyClick,
  onMapClick,
  onCenterChange,
  userLocation,
  selectedPoint,
  pickMode = false,
  centerPinMode = false,
  mapHandle,
}: PharmacyMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: env.googleMapsApiKey,
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // Drag state lives in a DOM ref — mutate the center-pin's style directly on
  // drag start / end so no React re-render is triggered.
  const centerPinRef = useRef<SVGSVGElement | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always reference the latest click handler without retriggering the marker
  // effect — we don't want to recreate every marker just because the parent
  // passed a new function reference.
  const onPharmacyClickRef = useRef(onPharmacyClick);
  useEffect(() => {
    onPharmacyClickRef.current = onPharmacyClick;
  }, [onPharmacyClick]);

  const center = useMemo(() => {
    // Address picker (centerPinMode) follows the user's pin / location.
    // Pharmacy picker (the other use of this map) always opens centred on
    // Dushanbe so the whole city + every pharmacy fits in view from the
    // first frame, regardless of which one happens to be first in the list.
    if (centerPinMode) {
      if (selectedPoint) return { lat: selectedPoint.lat, lng: selectedPoint.lng };
      if (userLocation) return { lat: userLocation.lat, lng: userLocation.lng };
    }
    return DUSHANBE_CENTER;
  }, [centerPinMode, userLocation, selectedPoint]);

  // Dushanbe-scale zoom — wide enough to show major districts and the
  // pharmacies scattered across the city, tight enough to read street names.
  // Address picker keeps its previous neighbourhood-level zoom.
  const initialZoom = centerPinMode ? 14 : 13;

  const handleMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!onMapClick || !e.latLng) return;
      const point: GeoPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      const provider = getMapProvider();
      const result = await provider.reverseGeocode(point);
      if (result) onMapClick(result);
    },
    [onMapClick],
  );

  const handleIdle = useCallback(async () => {
    if (!centerPinMode || !onCenterChange || !mapRef.current) return;
    const c = mapRef.current.getCenter();
    if (!c) return;
    const point: GeoPoint = { lat: c.lat(), lng: c.lng() };
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(async () => {
      const provider = getMapProvider();
      const result = await provider.reverseGeocode(point);
      if (result) onCenterChange(result);
    }, 300);
  }, [centerPinMode, onCenterChange]);

  // ─── AdvancedMarker lifecycle ────────────────────────────────────────
  //
  // Markers are kept in a ref Map keyed by pharmacy id so we:
  //   • add new ones when pharmacies appear
  //   • update `position` and `content` in place when data changes
  //   • remove ones that are no longer in the list
  //
  // Critically, unchanged markers are *not* recreated between renders —
  // Google's native marker layer handles their positioning frame-by-frame
  // during drag, so there's no release-time desync.
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  useEffect(() => {
    if (!map) return;
    // The marker library might not be on `google.maps.marker` yet if the
    // script hasn't finished loading.
    const markerLib = (google.maps as typeof google.maps & {
      marker?: { AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement };
    }).marker;
    if (!markerLib?.AdvancedMarkerElement) return;

    const current = markersRef.current;
    const nextIds = new Set(pharmacies.map((p) => p.id));

    // Remove markers whose pharmacy is no longer in the list.
    for (const [id, marker] of current) {
      if (!nextIds.has(id)) {
        marker.map = null;
        current.delete(id);
      }
    }

    // Add / update the rest.
    for (const pharmacy of pharmacies) {
      const existing = current.get(pharmacy.id);
      if (existing) {
        existing.position = { lat: pharmacy.lat, lng: pharmacy.lng };
        // Replace content in place so price / name updates don't recreate the
        // marker (which would cause a visual flash).
        existing.content = createPinElement(pharmacy);
      } else {
        const content = createPinElement(pharmacy);
        const marker = new markerLib.AdvancedMarkerElement({
          map,
          position: { lat: pharmacy.lat, lng: pharmacy.lng },
          content,
          gmpClickable: true,
          // REQUIRED — every pharmacy stays visible at every zoom level.
          // (We tried OPTIONAL_AND_HIDES_LOWER_PRIORITY for collision
          // handling, but it made markers disappear at common zooms;
          // the user prefers seeing all of them and stacking visually
          // at low zoom over having any one go missing.)
          collisionBehavior: google.maps.CollisionBehavior.REQUIRED,
          // zIndex still tracks "cheaper-on-top" so when bubbles do
          // overlap, the lower-priced one paints in front.
          zIndex: typeof pharmacy.cost === "number" && pharmacy.cost > 0
            ? -Math.round(pharmacy.cost)
            : 0,
        });
        marker.addListener("gmp-click", () => {
          onPharmacyClickRef.current?.(pharmacy.id);
        });
        current.set(pharmacy.id, marker);
      }
    }
  }, [map, pharmacies]);

  // Full cleanup on unmount.
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.map = null;
      }
      markersRef.current.clear();
    };
  }, []);

  // Re-centre on Dushanbe + reset the zoom every time the picker opens.
  // The component remounts per open, so this runs once per mount; user
  // panning/zooming after that is preserved.
  const initialCenteredRef = useRef(false);
  useEffect(() => {
    if (centerPinMode) return;
    if (!map || initialCenteredRef.current) return;
    map.setCenter(DUSHANBE_CENTER);
    map.setZoom(initialZoom);
    initialCenteredRef.current = true;
  }, [map, centerPinMode, initialZoom]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center rounded-xl xs:rounded-2xl bg-surface-container-low text-sm text-on-surface-variant p-4 xs:p-6 ${className}`}>
        Не удалось загрузить карту
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`relative overflow-hidden rounded-xl xs:rounded-2xl ${className}`}>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-low">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl xs:rounded-2xl ${className}`}>
      {centerPinMode && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center" style={{ marginBottom: 36 }}>
            <svg
              ref={centerPinRef}
              width="40"
              height="52"
              viewBox="0 0 40 52"
              fill="none"
              className="transition-transform duration-150"
            >
              <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#0E8B60" />
              <circle cx="20" cy="18" r="8" fill="white" />
              <circle cx="20" cy="18" r="4" fill="#0E8B60" />
            </svg>
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={centerPinMode ? undefined : center}
        zoom={initialZoom}
        options={MAP_OPTIONS}
        onLoad={(m) => {
          mapRef.current = m;
          setMap(m);
          if (centerPinMode) {
            const initPos = selectedPoint
              ? { lat: selectedPoint.lat, lng: selectedPoint.lng }
              : userLocation
                ? { lat: userLocation.lat, lng: userLocation.lng }
                : DUSHANBE_CENTER;
            m.setCenter(initPos);
          }
          mapHandle?.({ panTo: (pt) => m.panTo({ lat: pt.lat, lng: pt.lng }) });
        }}
        onUnmount={() => {
          mapHandle?.(null);
          mapRef.current = null;
          setMap(null);
        }}
        onClick={pickMode ? handleMapClick : undefined}
        onIdle={centerPinMode ? handleIdle : undefined}
        onDragStart={() => {
          if (centerPinRef.current) {
            centerPinRef.current.style.transform = "translateY(-8px) scale(1.1)";
          }
        }}
        onDragEnd={() => {
          if (centerPinRef.current) {
            centerPinRef.current.style.transform = "";
          }
        }}
      >
        {/* User location marker */}
        {userLocation && !centerPinMode && (
          <Marker
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
            title="Вы здесь"
            icon={{
              url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#0E8B60"/><circle cx="16" cy="14" r="6" fill="white"/></svg>'),
              scaledSize: new google.maps.Size(32, 42),
              anchor: new google.maps.Point(16, 42),
            }}
            label={{ text: "Вы", color: "#fff", fontWeight: "bold", fontSize: "11px" }}
          />
        )}

        {/* Selected point marker (legacy pickMode) */}
        {selectedPoint && !centerPinMode && (
          <OverlayView
            position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              style={{
                width: 20,
                height: 20,
                background: "#ff3b30",
                border: "3px solid white",
                borderRadius: "50%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                transform: "translate(-50%, -50%)",
              }}
            />
          </OverlayView>
        )}
      </GoogleMap>
    </div>
  );
}

// Light-blue bubble color used by the marker pill + tail. Kept as a literal
// rather than a Tailwind token because the SVG-style border-color shorthand
// for the tail must resolve at runtime.
const BUBBLE_BG = "#BAE6FD"; // tailwind sky-200
const BUBBLE_RING = "rgba(56, 189, 248, 0.4)"; // sky-400 @ 40%

// Tail tip horizontal position, measured from the content's left edge in
// pixels. Picked at the bubble's bottom-LEFT corner area (inside the
// border-radius so the triangle visually attaches to the bubble cleanly).
// The transform below uses this constant to shift the whole content so the
// tail tip ends up at the AdvancedMarker's default bottom-center anchor —
// the tip is what marks the exact pharmacy coord.
const TAIL_TIP_OFFSET_PX = 20;

/**
 * Build the DOM tree for a pharmacy pin.
 *
 * Layout: a horizontal speech-bubble (avatar + name + optional price chip)
 * with a downward-pointing tail anchored at the bubble's bottom-LEFT corner.
 * The bubble sits up-and-to-the-right of the geo coord; the corner tail's
 * tip lines up exactly with the coord (rather than the bubble's centre, so
 * the user reads the marker visually pointing at "this pharmacy is here").
 *
 * Sizing: Tailwind responsive utilities scale the bubble down at narrower
 * viewports — the marker shrinks roughly proportionally to screen width
 * via `sm:` and `md:` breakpoints applied to padding, gap, avatar, font.
 *
 * Returned as a real HTMLElement so we can hand it to AdvancedMarkerElement's
 * `content` — the native marker layer takes care of positioning from here.
 */
function createPinElement(pharmacy: PharmacyMarker): HTMLElement {
  const iconSrc = pharmacy.iconUrl
    ? pharmacy.iconUrl.startsWith("http")
      ? pharmacy.iconUrl
      : `/api/pharmacies/icon/${pharmacy.id}/content?w=120`
    : null;

  const hasCost = typeof pharmacy.cost === "number" && pharmacy.cost > 0;

  const root = document.createElement("div");
  root.className = "cursor-pointer select-none flex flex-col items-stretch";
  // Anchor math: AdvancedMarker positions content with its bottom-center at
  // the geo coord. We want the tail TIP at the coord instead. The tail tip
  // sits at TAIL_TIP_OFFSET_PX from the content's left edge, while the
  // default anchor is at width/2 from left. translateX(calc(50% - Npx))
  // shifts the content right by (W/2 − N), making the tail tip align with
  // the original anchor X regardless of how wide the bubble grows.
  root.style.transform = `translateX(calc(50% - ${TAIL_TIP_OFFSET_PX}px))`;
  root.setAttribute("aria-label", pharmacy.title);

  const pill = document.createElement("div");
  // Phone (default) values are ~20% smaller than the sm+ breakpoint —
  // markers stay readable on a 360px screen without crowding the map.
  pill.className =
    "flex items-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl pl-0.5 pr-1.5 py-0.5 sm:pr-2.5 sm:py-1 shadow-float transition";
  pill.style.background = BUBBLE_BG;
  pill.style.boxShadow = `0 4px 12px rgba(0,0,0,0.15), inset 0 0 0 1px ${BUBBLE_RING}`;
  pill.style.transition = "transform 150ms ease-out";
  pill.addEventListener("mouseenter", () => {
    pill.style.transform = "scale(1.05)";
  });
  pill.addEventListener("mouseleave", () => {
    pill.style.transform = "";
  });

  const avatar = document.createElement("div");
  avatar.className =
    "flex h-6 w-6 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white";
  if (iconSrc) {
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.loading = "lazy";
    img.className = "h-full w-full object-cover";
    avatar.appendChild(img);
  } else {
    avatar.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369a1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15"/><path d="M12 9v6"/><path d="M9 12h6"/></svg>';
  }
  pill.appendChild(avatar);

  const name = document.createElement("span");
  name.className = "max-w-[80px] sm:max-w-[140px] md:max-w-[180px] truncate text-[10px] sm:text-xs md:text-sm font-extrabold text-on-surface";
  name.textContent = pharmacy.title;
  pill.appendChild(name);

  if (hasCost) {
    const price = document.createElement("span");
    price.className =
      "flex-shrink-0 rounded-full bg-accent px-1 sm:px-2 py-0 sm:py-0.5 text-[9px] sm:text-xs font-extrabold text-on-surface tabular-nums";
    price.textContent = formatMoney(pharmacy.cost!);
    pill.appendChild(price);
  }

  root.appendChild(pill);

  // Tail row: zero-height, holds the absolutely-positioned triangle. The
  // wrapper's bottom edge (= triangle tip) is the bottom of the content
  // box, which is what AdvancedMarker's default anchor ties to.
  const tailRow = document.createElement("div");
  tailRow.style.position = "relative";
  tailRow.style.height = "8px";

  const tail = document.createElement("span");
  tail.setAttribute("aria-hidden", "true");
  Object.assign(tail.style, {
    position: "absolute",
    // Triangle 14px wide × 8px tall — centre at TAIL_TIP_OFFSET_PX.
    left: `${TAIL_TIP_OFFSET_PX - 7}px`,
    top: "0",
    width: "0",
    height: "0",
    borderLeft: "7px solid transparent",
    borderRight: "7px solid transparent",
    borderTop: `8px solid ${BUBBLE_BG}`,
    filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.1))",
  } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  tailRow.appendChild(tail);
  root.appendChild(tailRow);

  return root;
}
