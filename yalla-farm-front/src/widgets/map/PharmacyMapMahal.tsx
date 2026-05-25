"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DUSHANBE_CENTER, getMapProvider, type GeoPoint } from "@/shared/lib/map";
import { formatMoney } from "@/shared/lib/format";
import type { PharmacyMapProps, PharmacyMarker } from "./PharmacyMapYandex";

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 13;
const PICK_ZOOM = 14;
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const GESTURE_ZOOM_SPEED = 1.4;
const loadedTileSources = new Set<string>();

type Size = { width: number; height: number };
type WorldPoint = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrapTileX(x: number, zoom: number) {
  const n = 2 ** zoom;
  return ((x % n) + n) % n;
}

function latLngToWorld(point: GeoPoint, zoom: number): WorldPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = clamp(point.lat, -85.05112878, 85.05112878);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function worldToLatLng(point: WorldPoint, zoom: number): GeoPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (point.x / scale) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * point.y) / scale)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

function tileSrc(zoom: number, x: number, y: number) {
  return TILE_URL
    .replace("{z}", String(zoom))
    .replace("{x}", String(wrapTileX(x, zoom)))
    .replace("{y}", String(y));
}

function visibleTileSources(center: GeoPoint, zoom: number, size: Size, tileZoom: number) {
  if (size.width <= 0 || size.height <= 0) return [];

  const zoomScale = 2 ** (zoom - tileZoom);
  const tileWorldCenter = latLngToWorld(center, tileZoom);
  const tileTopLeft = {
    x: tileWorldCenter.x - size.width / (2 * zoomScale),
    y: tileWorldCenter.y - size.height / (2 * zoomScale),
  };
  const tileStartX = Math.floor(tileTopLeft.x / TILE_SIZE) - 1;
  const tileEndX = Math.ceil((tileTopLeft.x + size.width / zoomScale) / TILE_SIZE) + 1;
  const tileStartY = clamp(Math.floor(tileTopLeft.y / TILE_SIZE) - 1, 0, 2 ** tileZoom - 1);
  const tileEndY = clamp(Math.ceil((tileTopLeft.y + size.height / zoomScale) / TILE_SIZE) + 1, 0, 2 ** tileZoom - 1);
  const sources: string[] = [];

  for (let x = tileStartX; x <= tileEndX; x += 1) {
    for (let y = tileStartY; y <= tileEndY; y += 1) {
      sources.push(tileSrc(tileZoom, x, y));
    }
  }

  return sources;
}

async function preloadTileSources(sources: string[]) {
  const pending = sources
    .filter((src) => !loadedTileSources.has(src))
    .map((src) => new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => {
        loadedTileSources.add(src);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = src;
    }));

  await Promise.all(pending);
}

export function PharmacyMapMahal({
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
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWorld: WorldPoint;
    moved: boolean;
  } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    lastDistance: number;
  } | null>(null);

  const initialCenter = useMemo(() => {
    if (centerPinMode) {
      if (selectedPoint) return selectedPoint;
      if (userLocation) return userLocation;
    }
    return DUSHANBE_CENTER;
  }, [centerPinMode, selectedPoint, userLocation]);

  const [center, setCenter] = useState<GeoPoint>(initialCenter);
  const [zoom, setZoom] = useState(centerPinMode ? PICK_ZOOM : DEFAULT_ZOOM);
  const [renderTileZoom, setRenderTileZoom] = useState(centerPinMode ? PICK_ZOOM : DEFAULT_ZOOM);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const sizeRef = useRef(size);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const reverseCenter = (point: GeoPoint) => {
    if (!centerPinMode || !onCenterChange) return;
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(async () => {
      const result = await getMapProvider().reverseGeocode(point);
      if (result) onCenterChange(result);
    }, 300);
  };

  useEffect(() => {
    mapHandle?.({
      panTo: (point) => {
        setCenter(point);
        reverseCenter(point);
      },
      fitDushanbe: () => {
        setCenter(DUSHANBE_CENTER);
        setZoom(DEFAULT_ZOOM);
      },
      highlightPharmacy: (id) => {
        setHighlightedId(id);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => setHighlightedId(null), 1000);
      },
    });
    return () => {
      mapHandle?.(null);
    };
    // Parent callback is intentionally excluded; the handle should stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerPinMode, onCenterChange]);

  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const desiredTileZoom = clamp(Math.floor(zoom), MIN_ZOOM, MAX_ZOOM);

  useEffect(() => {
    if (desiredTileZoom === renderTileZoom || size.width <= 0 || size.height <= 0) return;

    let cancelled = false;
    const sources = visibleTileSources(center, zoom, size, desiredTileZoom);
    preloadTileSources(sources).then(() => {
      if (!cancelled) setRenderTileZoom(desiredTileZoom);
    });

    return () => {
      cancelled = true;
    };
  }, [center, desiredTileZoom, renderTileZoom, size, zoom]);

  const tileZoom = renderTileZoom;
  const zoomScale = 2 ** (zoom - tileZoom);
  const worldCenter = latLngToWorld(center, zoom);
  const tileWorldCenter = latLngToWorld(center, tileZoom);
  const topLeft = {
    x: worldCenter.x - size.width / 2,
    y: worldCenter.y - size.height / 2,
  };
  const tileTopLeft = {
    x: tileWorldCenter.x - size.width / (2 * zoomScale),
    y: tileWorldCenter.y - size.height / (2 * zoomScale),
  };
  const tileWorldMax = TILE_SIZE * 2 ** tileZoom;
  const tileStartX = Math.floor(tileTopLeft.x / TILE_SIZE) - 1;
  const tileEndX = Math.ceil((tileTopLeft.x + size.width / zoomScale) / TILE_SIZE) + 1;
  const tileStartY = clamp(Math.floor(tileTopLeft.y / TILE_SIZE) - 1, 0, 2 ** tileZoom - 1);
  const tileEndY = clamp(Math.ceil((tileTopLeft.y + size.height / zoomScale) / TILE_SIZE) + 1, 0, 2 ** tileZoom - 1);

  const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];
  for (let x = tileStartX; x <= tileEndX; x += 1) {
    for (let y = tileStartY; y <= tileEndY; y += 1) {
      tiles.push({
        key: `${tileZoom}:${x}:${y}`,
        src: tileSrc(tileZoom, x, y),
        left: (x * TILE_SIZE - tileTopLeft.x) * zoomScale,
        top: (y * TILE_SIZE - tileTopLeft.y) * zoomScale,
      });
    }
  }

  const pointToScreen = (point: GeoPoint) => {
    const world = latLngToWorld(point, zoom);
    return {
      left: world.x - topLeft.x,
      top: world.y - topLeft.y,
    };
  };

  const screenToPoint = (clientX: number, clientY: number): GeoPoint | null => {
    const node = containerRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const x = tileTopLeft.x + (clientX - rect.left) / zoomScale;
    const y = clamp(tileTopLeft.y + (clientY - rect.top) / zoomScale, 0, tileWorldMax);
    return worldToLatLng({ x, y }, tileZoom);
  };

  const setZoomByDelta = (delta: number) => {
    const nextZoom = clamp(zoomRef.current + delta, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom !== zoomRef.current) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      if (centerPinMode) reverseCenter(centerRef.current);
    }
  };

  const handleWheelZoom = (event: WheelEvent) => {
    const lineHeight = 16;
    const pageHeight = Math.max(sizeRef.current.height, 600);
    const normalizedDeltaY = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * lineHeight
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * pageHeight
        : event.deltaY;
    const sensitivity = (event.ctrlKey ? 260 : 420) / GESTURE_ZOOM_SPEED;
    const deltaZoom = clamp(-normalizedDeltaY / sensitivity, -0.8, 0.8);
    if (Math.abs(deltaZoom) < 0.001) return;
    setZoomByDelta(deltaZoom);
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleWheelZoom(event);
    };
    const preventBrowserGesture = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("gesturestart", preventBrowserGesture, { passive: false });
    node.addEventListener("gesturechange", preventBrowserGesture, { passive: false });
    node.addEventListener("gestureend", preventBrowserGesture, { passive: false });

    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("gesturestart", preventBrowserGesture);
      node.removeEventListener("gesturechange", preventBrowserGesture);
      node.removeEventListener("gestureend", preventBrowserGesture);
    };
    // Native non-passive listeners are required to block browser/page zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerPinMode]);

  const pointerDistance = () => {
    const pointers = Array.from(pointersRef.current.values());
    if (pointers.length < 2) return null;
    return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const node = containerRef.current;
    if (!node) return;
    node.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      const distance = pointerDistance();
      if (distance) {
        pinchRef.current = {
          lastDistance: distance,
        };
      }
      return;
    }

    pinchRef.current = null;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWorld: latLngToWorld(centerRef.current, zoomRef.current),
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const distance = pointerDistance();
      if (!distance) return;

      const ratio = distance / pinchRef.current.lastDistance;
      if (Number.isFinite(ratio) && ratio > 0) {
        const deltaZoom = clamp(Math.log2(ratio) * 1.4 * GESTURE_ZOOM_SPEED, -0.63, 0.63);
        pinchRef.current.lastDistance = distance;
        if (Math.abs(deltaZoom) >= 0.001) setZoomByDelta(deltaZoom);
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const nextWorld = {
      x: drag.startWorld.x - dx,
      y: clamp(drag.startWorld.y - dy, 0, TILE_SIZE * 2 ** zoomRef.current),
    };
    setCenter(worldToLatLng(nextWorld, zoomRef.current));
  };

  const finishPointer = async (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
      if (centerPinMode) reverseCenter(centerRef.current);
    }

    try {
      containerRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released by the browser.
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    if (!drag.moved && pickMode && onMapClick) {
      const point = screenToPoint(event.clientX, event.clientY);
      if (point) {
        const result = await getMapProvider().reverseGeocode(point);
        if (result) onMapClick(result);
      }
      return;
    }

    if (centerPinMode) reverseCenter(centerRef.current);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl xs:rounded-2xl bg-surface-container-low ${className}`}>
      <div
        ref={containerRef}
        className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onContextMenu={(event) => event.preventDefault()}
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
            style={{
              left: tile.left,
              top: tile.top,
              width: TILE_SIZE * zoomScale,
              height: TILE_SIZE * zoomScale,
            }}
          />
        ))}

        {userLocation && !centerPinMode ? (
          <UserMarker style={pointToScreen(userLocation)} />
        ) : null}

        {selectedPoint && !centerPinMode ? (
          <SelectedMarker style={pointToScreen(selectedPoint)} />
        ) : null}

        {pharmacies.map((pharmacy) => (
          <PharmacyPin
            key={pharmacy.id}
            pharmacy={pharmacy}
            position={pointToScreen(pharmacy)}
            highlighted={highlightedId === pharmacy.id}
            onClick={() => onPharmacyClick?.(pharmacy.id)}
          />
        ))}
      </div>

      {centerPinMode ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <svg width="40" height="52" viewBox="0 0 40 52" fill="none" style={{ marginBottom: 36 }}>
            <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#2F80ED" />
            <circle cx="20" cy="18" r="8" fill="white" />
            <circle cx="20" cy="18" r="4" fill="#2F80ED" />
          </svg>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-1 right-2 z-20 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-on-surface-variant shadow-sm">
        © OpenStreetMap
      </div>
    </div>
  );
}

function PharmacyPin({
  pharmacy,
  position,
  highlighted,
  onClick,
}: {
  pharmacy: PharmacyMarker;
  position: { left: number; top: number };
  highlighted: boolean;
  onClick: () => void;
}) {
  const iconSrc = pharmacy.iconUrl
    ? pharmacy.iconUrl.startsWith("http")
      ? pharmacy.iconUrl
      : `/api/pharmacies/icon/${pharmacy.id}/content?w=120`
    : null;
  const hasCost = typeof pharmacy.cost === "number" && pharmacy.cost > 0;

  return (
    <button
      type="button"
      aria-label={pharmacy.title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute z-30 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-transform duration-150 hover:scale-105 ${
        highlighted ? "pharmacy-marker-pulse" : ""
      }`}
      style={{ left: position.left, top: position.top }}
    >
      <span className="flex max-w-[220px] items-center gap-2 rounded-full border border-black/10 bg-white py-1 pl-1 pr-2.5 shadow-[0_6px_20px_rgba(15,23,42,0.18),0_1px_2px_rgba(15,23,42,0.06)]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container">
          {iconSrc ? (
            <img src={iconSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18" />
              <path d="M5 21V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15" />
              <path d="M12 9v6" />
              <path d="M9 12h6" />
            </svg>
          )}
        </span>
        <span className="max-w-[140px] truncate text-xs font-bold text-on-surface">{pharmacy.title}</span>
        {hasCost ? (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-on-surface">
            {formatMoney(pharmacy.cost!)}
          </span>
        ) : null}
      </span>
      <svg width="16" height="9" viewBox="0 0 16 9" aria-hidden="true" className="-mt-px drop-shadow-sm">
        <path d="M0 0 L8 9 L16 0 Z" fill="#FFFFFF" stroke="rgba(15,23,42,0.10)" strokeWidth="1" />
      </svg>
    </button>
  );
}

function UserMarker({ style }: { style: { left: number; top: number } }) {
  return (
    <div className="absolute z-20 -translate-x-1/2 -translate-y-full" style={style}>
      <svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#2F80ED" />
        <circle cx="16" cy="14" r="6" fill="white" />
      </svg>
    </div>
  );
}

function SelectedMarker({ style }: { style: { left: number; top: number } }) {
  return (
    <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={style}>
      <span className="block h-5 w-5 rounded-full border-[3px] border-white bg-[#ff3b30] shadow" />
    </div>
  );
}
