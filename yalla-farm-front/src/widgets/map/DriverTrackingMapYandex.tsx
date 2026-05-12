/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadYmaps } from "@/shared/lib/map/yandex-loader";
import type { GeoPoint } from "@/shared/lib/map";
import { getDriverPosition } from "@/shared/api/delivery";
import type { DriverTrackingMapProps } from "./DriverTrackingMapGoogle";

/** Yandex v2 variant of the order-tracking mini-map. Two static
 *  endpoint pins (pharmacy + client) plus a polled driver pin that
 *  updates in place every 5 s. lat-first throughout. */
export function DriverTrackingMapYandex({
  token,
  orderId,
  fromPoint,
  toPoint,
  className = "",
}: DriverTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ymapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    loadYmaps()
      .then((ymaps) => {
        if (disposed || !containerRef.current) return;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [fromPoint.lat, fromPoint.lng],
            zoom: 13,
            controls: ["zoomControl"],
          },
          {
            yandexMapDisablePoiInteractivity: true,
            suppressMapOpenBlock: true,
          },
        );

        const fromDot = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#0E8B60" stroke="white" stroke-width="2"/></svg>`;
        const toDot = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#ef4444" stroke="white" stroke-width="2"/></svg>`;

        map.geoObjects.add(new ymaps.Placemark(
          [fromPoint.lat, fromPoint.lng],
          {},
          {
            iconLayout: "default#image",
            iconImageHref: "data:image/svg+xml," + encodeURIComponent(fromDot),
            iconImageSize: [12, 12],
            iconImageOffset: [-6, -6],
            hasBalloon: false,
            hasHint: false,
          },
        ));
        map.geoObjects.add(new ymaps.Placemark(
          [toPoint.lat, toPoint.lng],
          {},
          {
            iconLayout: "default#image",
            iconImageHref: "data:image/svg+xml," + encodeURIComponent(toDot),
            iconImageSize: [12, 12],
            iconImageOffset: [-6, -6],
            hasBalloon: false,
            hasHint: false,
          },
        ));

        ymapsRef.current = ymaps;
        mapRef.current = map;
        setIsLoaded(true);
      })
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : "Карта недоступна");
      });

    return () => {
      disposed = true;
      try { mapRef.current?.destroy(); } catch { /* ignore */ }
      mapRef.current = null;
    };
    // From/to coords are immutable per session — no need to recreate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    function updateDriverMarker(pos: GeoPoint) {
      const ymaps = ymapsRef.current;
      const map = mapRef.current;
      if (!ymaps || !map) return;

      if (driverMarkerRef.current) {
        driverMarkerRef.current.geometry.setCoordinates([pos.lat, pos.lng]);
        return;
      }
      const driverDot =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#10b981" stroke="white" stroke-width="2"/></svg>';
      const placemark = new ymaps.Placemark(
        [pos.lat, pos.lng],
        {},
        {
          iconLayout: "default#image",
          iconImageHref: "data:image/svg+xml," + encodeURIComponent(driverDot),
          iconImageSize: [16, 16],
          iconImageOffset: [-8, -8],
          hasBalloon: false,
          hasHint: false,
        },
      );
      map.geoObjects.add(placemark);
      driverMarkerRef.current = placemark;
    }

    async function poll() {
      while (active) {
        try {
          const pos = await getDriverPosition(token, orderId);
          if (active) {
            updateDriverMarker({ lat: pos.lat, lng: pos.lng });
            setError(null);
          }
        } catch {
          if (active) setError("Позиция водителя недоступна");
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    poll();
    return () => { active = false; };
  }, [token, orderId, isLoaded]);

  if (error && !isLoaded) {
    return (
      <div className={className}>
        <div className="w-full h-48 xs:h-56 sm:h-64 rounded-xl overflow-hidden flex items-center justify-center bg-surface-container-low text-sm text-on-surface-variant">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative w-full h-48 xs:h-56 sm:h-64 rounded-xl overflow-hidden">
        {!isLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : null}
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {error && isLoaded ? <p className="mt-1 text-xs text-on-surface-variant">{error}</p> : null}
    </div>
  );
}
