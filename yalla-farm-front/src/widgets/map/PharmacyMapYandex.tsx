/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadYmaps } from "@/shared/lib/map/yandex-loader";
import { DUSHANBE_CENTER, getMapProvider, type GeoPoint } from "@/shared/lib/map";
import { formatMoney } from "@/shared/lib/format";
import type { PharmacyMapHandle, PharmacyMapProps, PharmacyMarker } from "./PharmacyMapGoogle";

/**
 * Yandex Maps v2.1 variant of PharmacyMap. Same props contract as the
 * Google variant — the runtime switch in `PharmacyMap.tsx` picks one or
 * the other based on `NEXT_PUBLIC_MAP_PROVIDER`.
 *
 * Pharmacy pills are real DOM elements rendered through ymaps2's
 * `templateLayoutFactory` — we attach our own children on `build` so the
 * `createPinElement` shape (icon + name + price tail) stays identical to
 * the Google version, click handlers and all.
 *
 * Coords are lat-first throughout because the SDK is loaded with
 * `coordorder=latlong` (see yandex-loader.ts). That keeps the rest of
 * the app's `{ lat, lng }` shape working without conversions.
 */
export function PharmacyMapYandex({
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const ymapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const centerPinRef = useRef<SVGSVGElement | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest pharmacy-click handler in a ref so we don't recreate
  // markers each time the parent passes a new function reference.
  const onPharmacyClickRef = useRef(onPharmacyClick);
  useEffect(() => {
    onPharmacyClickRef.current = onPharmacyClick;
  }, [onPharmacyClick]);

  const initialCenter = useMemo(() => {
    if (centerPinMode) {
      if (selectedPoint) return selectedPoint;
      if (userLocation) return userLocation;
    }
    return DUSHANBE_CENTER;
  }, [centerPinMode, userLocation, selectedPoint]);
  const initialZoom = centerPinMode ? 14 : 13;

  // ─── SDK + map init (one-shot per mount) ─────────────────────────────
  useEffect(() => {
    let disposed = false;
    loadYmaps()
      .then((ymaps) => {
        if (disposed || !containerRef.current) return;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [initialCenter.lat, initialCenter.lng],
            zoom: initialZoom,
            // Strip every default control — the rest of the page provides
            // its own UI (sort chips, panel collapse, etc.). Same as the
            // disableDefaultUI block in the Google variant.
            controls: [],
          },
          {
            // greedy = single-finger pan/zoom on touch devices.
            yandexMapDisablePoiInteractivity: true,
            suppressMapOpenBlock: true,
          },
        );

        // Map click — only fires in legacy pickMode. Reverse-geocodes the
        // tapped point through whatever provider is active.
        map.events.add("click", async (e: any) => {
          if (!pickMode || !onMapClick) return;
          const coords = e.get("coords"); // [lat, lng] thanks to coordorder=latlong
          if (!Array.isArray(coords)) return;
          const point: GeoPoint = { lat: coords[0], lng: coords[1] };
          const provider = getMapProvider();
          const result = await provider.reverseGeocode(point);
          if (result) onMapClick(result);
        });

        // Drag-to-pick UX — the centre pin (a DOM overlay above the map)
        // animates up when the user grabs, snaps back on release; after
        // the map settles we reverse-geocode the new centre.
        map.events.add("actionbegin", () => {
          if (centerPinRef.current) {
            centerPinRef.current.style.transform = "translateY(-8px) scale(1.1)";
          }
        });
        map.events.add("actionend", () => {
          if (centerPinRef.current) {
            centerPinRef.current.style.transform = "";
          }
        });
        map.events.add("boundschange", () => {
          if (!centerPinMode || !onCenterChange) return;
          const c = map.getCenter();
          if (!Array.isArray(c)) return;
          const point: GeoPoint = { lat: c[0], lng: c[1] };
          if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = setTimeout(async () => {
            const provider = getMapProvider();
            const result = await provider.reverseGeocode(point);
            if (result) onCenterChange(result);
          }, 300);
        });

        ymapsRef.current = ymaps;
        mapRef.current = map;
        setIsLoaded(true);

        mapHandle?.({
          panTo: (pt) => {
            map.panTo([pt.lat, pt.lng], { duration: 300 });
          },
          fitDushanbe: () => {
            // setCenter accepts a third "options" arg with duration for
            // animated transitions; doing both center + zoom in one
            // call avoids a two-step pan-then-snap effect.
            map.setCenter(
              [DUSHANBE_CENTER.lat, DUSHANBE_CENTER.lng],
              initialZoom,
              { duration: 400 },
            );
          },
          highlightPharmacy: (id) => {
            const marker = markersRef.current.get(id) as
              | { __el?: HTMLElement }
              | undefined;
            const root = marker?.__el;
            if (!root) return;
            // Restart the keyframe: removing then re-adding the class
            // (with a forced reflow in between) re-triggers the
            // animation even if a previous pulse hadn't finished.
            root.classList.remove("pharmacy-marker-pulse");
            void root.offsetWidth;
            root.classList.add("pharmacy-marker-pulse");
            window.setTimeout(() => {
              root.classList.remove("pharmacy-marker-pulse");
            }, 1000);
          },
        });
      })
      .catch((err) => {
        if (!disposed) setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      disposed = true;
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      mapHandle?.(null);
      try {
        mapRef.current?.destroy();
      } catch { /* StrictMode dev double-unmount */ }
      mapRef.current = null;
    };
    // initialCenter/initialZoom only matter on first mount; subsequent
    // updates flow through panTo / Dushanbe re-centre below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Pharmacy markers (custom HTML pills) ────────────────────────────
  const markersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!isLoaded) return;
    const ymaps = ymapsRef.current;
    const map = mapRef.current;
    if (!ymaps || !map) return;

    const current = markersRef.current;
    const nextIds = new Set(pharmacies.map((p) => p.id));

    // Drop markers no longer in the list.
    for (const [id, marker] of current) {
      if (!nextIds.has(id)) {
        try { map.geoObjects.remove(marker); } catch { /* ignore */ }
        current.delete(id);
      }
    }

    // Add / update remaining.
    for (const pharmacy of pharmacies) {
      const existing = current.get(pharmacy.id);
      if (existing) {
        existing.geometry.setCoordinates([pharmacy.lat, pharmacy.lng]);
        const el = (existing as { __el?: HTMLElement }).__el;
        if (el) {
          el.innerHTML = "";
          el.appendChild(createPinElement(pharmacy, () => {
            onPharmacyClickRef.current?.(pharmacy.id);
          }));
        }
      } else {
        // Per-pharmacy layout class so each marker keeps its own DOM
        // even when many re-render in the same tick. The ymaps-generated
        // container holds a single anchor div that's absolutely
        // positioned so the bubble's bottom tip sits exactly on the geo
        // coord — the layout's element top-left is at the anchor by
        // default, so we shift our content by (-50%, -100%) on top.
        const wrapper = document.createElement("div");
        wrapper.appendChild(createPinElement(pharmacy, () => {
          onPharmacyClickRef.current?.(pharmacy.id);
        }));

        const Layout = ymaps.templateLayoutFactory.createClass(
          '<div class="yalla-pharmacy-marker" style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);will-change:transform;"></div>',
          {
            build: function () {
              Layout.superclass.build.call(this);
              const root = this.getElement()?.querySelector(".yalla-pharmacy-marker") as HTMLElement | null;
              if (root) {
                root.appendChild(wrapper);
              }
            },
            clear: function () {
              try { wrapper.parentElement?.removeChild(wrapper); } catch { /* ignore */ }
              Layout.superclass.clear.call(this);
            },
          },
        );

        const placemark = new ymaps.Placemark(
          [pharmacy.lat, pharmacy.lng],
          {},
          {
            iconLayout: Layout,
            // Hit area covers the whole pill ~ 200×56 above the coord,
            // anchored at bottom-center via the (-50%, -100%) translate.
            iconShape: {
              type: "Rectangle",
              coordinates: [[-100, -56], [100, 0]],
            },
            // Cheaper price paints in front when bubbles overlap.
            zIndex: typeof pharmacy.cost === "number" && pharmacy.cost > 0
              ? -Math.round(pharmacy.cost)
              : 0,
            hasBalloon: false,
            hasHint: false,
          },
        );
        (placemark as { __el?: HTMLElement }).__el = wrapper;
        map.geoObjects.add(placemark);
        current.set(pharmacy.id, placemark);
      }
    }
  }, [isLoaded, pharmacies]);

  useEffect(() => {
    const current = markersRef.current;
    return () => {
      const map = mapRef.current;
      if (!map) return;
      for (const marker of current.values()) {
        try { map.geoObjects.remove(marker); } catch { /* ignore */ }
      }
      current.clear();
    };
  }, []);

  // ─── First-open re-centre on Dushanbe ────────────────────────────────
  const initialCenteredRef = useRef(false);
  useEffect(() => {
    if (centerPinMode || !isLoaded || initialCenteredRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    map.setCenter([DUSHANBE_CENTER.lat, DUSHANBE_CENTER.lng], initialZoom);
    initialCenteredRef.current = true;
  }, [isLoaded, centerPinMode, initialZoom]);

  // ─── User-location marker ────────────────────────────────────────────
  const userMarkerRef = useRef<any>(null);
  useEffect(() => {
    if (!isLoaded) return;
    const ymaps = ymapsRef.current;
    const map = mapRef.current;
    if (!ymaps || !map) return;

    if (userMarkerRef.current) {
      try { map.geoObjects.remove(userMarkerRef.current); } catch { /* ignore */ }
      userMarkerRef.current = null;
    }
    if (userLocation && !centerPinMode) {
      const placemark = new ymaps.Placemark(
        [userLocation.lat, userLocation.lng],
        {},
        {
          iconLayout: "default#image",
          iconImageHref: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#0E8B60"/><circle cx="16" cy="14" r="6" fill="white"/></svg>',
          ),
          iconImageSize: [32, 42],
          iconImageOffset: [-16, -42],
          hasBalloon: false,
          hasHint: false,
        },
      );
      map.geoObjects.add(placemark);
      userMarkerRef.current = placemark;
    }
  }, [isLoaded, userLocation, centerPinMode]);

  // ─── Selected-point marker (legacy pickMode) ─────────────────────────
  const selectedMarkerRef = useRef<any>(null);
  useEffect(() => {
    if (!isLoaded) return;
    const ymaps = ymapsRef.current;
    const map = mapRef.current;
    if (!ymaps || !map) return;

    if (selectedMarkerRef.current) {
      try { map.geoObjects.remove(selectedMarkerRef.current); } catch { /* ignore */ }
      selectedMarkerRef.current = null;
    }
    if (selectedPoint && !centerPinMode) {
      const dotSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#ff3b30" stroke="white" stroke-width="3"/></svg>';
      const placemark = new ymaps.Placemark(
        [selectedPoint.lat, selectedPoint.lng],
        {},
        {
          iconLayout: "default#image",
          iconImageHref: "data:image/svg+xml," + encodeURIComponent(dotSvg),
          iconImageSize: [20, 20],
          iconImageOffset: [-10, -10],
          hasBalloon: false,
          hasHint: false,
        },
      );
      map.geoObjects.add(placemark);
      selectedMarkerRef.current = placemark;
    }
  }, [isLoaded, selectedPoint, centerPinMode]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center rounded-xl xs:rounded-2xl bg-surface-container-low text-sm text-on-surface-variant p-4 xs:p-6 ${className}`}>
        Не удалось загрузить карту
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl xs:rounded-2xl ${className}`}>
      {!isLoaded ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-low">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}

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

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// ── Marker pill ────────────────────────────────────────────────────────
//
// Visual contract: a horizontal capsule with the pharmacy avatar on the
// left, name in the middle, price in a yellow chip on the right, and a
// downward triangular tail centred on the bottom edge. The whole thing
// is white-on-shadow for crisp readability against any tile colour. The
// layout's outer wrapper sets `transform: translate(-50%, -100%)` on the
// ymaps anchor div, so the tail tip lines up with the geo coordinate.
const PILL_BG = "#FFFFFF";
const PILL_BORDER = "rgba(15, 23, 42, 0.10)";
const PILL_SHADOW = "0 6px 20px rgba(15, 23, 42, 0.18), 0 1px 2px rgba(15, 23, 42, 0.06)";
const PRICE_BG = "#FFD83D"; // accent yellow — matches the rest of the app
const PRICE_INK = "#1A1816";

function createPinElement(pharmacy: PharmacyMarker, onClick: () => void): HTMLElement {
  const iconSrc = pharmacy.iconUrl
    ? pharmacy.iconUrl.startsWith("http")
      ? pharmacy.iconUrl
      : `/api/pharmacies/icon/${pharmacy.id}/content?w=120`
    : null;

  const hasCost = typeof pharmacy.cost === "number" && pharmacy.cost > 0;

  // Outer anchor box — the pill's bottom-center is where the tail joins,
  // and we point that at the geo coord (the parent div from the layout
  // template handles the actual translate so this just sits flat).
  const root = document.createElement("div");
  root.setAttribute("aria-label", pharmacy.title);
  Object.assign(root.style, {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    userSelect: "none",
    fontFamily: "Inter, system-ui, sans-serif",
  } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  root.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  // Pill body.
  const pill = document.createElement("div");
  Object.assign(pill.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 10px 4px 4px",
    borderRadius: "999px",
    background: PILL_BG,
    boxShadow: PILL_SHADOW,
    border: `1px solid ${PILL_BORDER}`,
    whiteSpace: "nowrap",
    transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
    transformOrigin: "50% 100%",
  } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  pill.addEventListener("mouseenter", () => {
    pill.style.transform = "scale(1.06)";
    pill.style.boxShadow = "0 10px 28px rgba(15, 23, 42, 0.24), 0 1px 2px rgba(15, 23, 42, 0.08)";
  });
  pill.addEventListener("mouseleave", () => {
    pill.style.transform = "";
    pill.style.boxShadow = PILL_SHADOW;
  });

  // Avatar — circular, fixed 28px, border-only when there's a real photo
  // so the white edge separates it from the pill background.
  const avatar = document.createElement("div");
  Object.assign(avatar.style, {
    width: "28px",
    height: "28px",
    borderRadius: "9999px",
    background: "#F1F5F9",
    overflow: "hidden",
    flexShrink: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.9)",
  } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  if (iconSrc) {
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.loading = "lazy";
    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
    avatar.appendChild(img);
  } else {
    avatar.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369a1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15"/><path d="M12 9v6"/><path d="M9 12h6"/></svg>';
  }
  pill.appendChild(avatar);

  // Name — capped at 140px so the pill stays a sensible width on top of
  // a packed map. `nowrap + ellipsis` instead of Tailwind's `truncate`
  // class because the SDK strips classes during template instantiation.
  const name = document.createElement("span");
  name.textContent = pharmacy.title;
  Object.assign(name.style, {
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: "1.2",
    color: "#1A1816",
    maxWidth: "140px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  pill.appendChild(name);

  if (hasCost) {
    const price = document.createElement("span");
    price.textContent = formatMoney(pharmacy.cost!);
    Object.assign(price.style, {
      flexShrink: "0",
      padding: "2px 8px",
      borderRadius: "999px",
      background: PRICE_BG,
      color: PRICE_INK,
      fontSize: "12px",
      fontWeight: "800",
      lineHeight: "1.2",
      letterSpacing: "0.01em",
      fontVariantNumeric: "tabular-nums",
      marginLeft: "2px",
    } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
    pill.appendChild(price);
  }

  root.appendChild(pill);

  // Tail — centred under the pill, points down to the geo coord. SVG
  // gives us a single shape (filled triangle + matching shadow) that
  // doesn't have the seam two CSS borders would on retina screens.
  const tail = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  tail.setAttribute("width", "16");
  tail.setAttribute("height", "9");
  tail.setAttribute("viewBox", "0 0 16 9");
  tail.setAttribute("aria-hidden", "true");
  Object.assign(tail.style, {
    display: "block",
    marginTop: "-1px",
    filter: "drop-shadow(0 3px 2px rgba(15, 23, 42, 0.12))",
  } satisfies Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  tail.innerHTML =
    `<path d="M0 0 L8 9 L16 0 Z" fill="${PILL_BG}" stroke="${PILL_BORDER}" stroke-width="1" />`;
  root.appendChild(tail);

  return root;
}

export type { PharmacyMapHandle };
