/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadYmaps } from "@/shared/lib/map/yandex-loader";
import type { DispatchRouteMapProps } from "./DispatchRouteMapGoogle";

/** Yandex v2 variant of the from→to mini-map used in
 *  DispatchDeliveryModal — pharmacy pin + client pin, no controls
 *  besides zoom, fixed zoom 13 like the Google variant. */
export function DispatchRouteMapYandex({
  fromPoint,
  toPoint,
  heightClassName = "h-48 sm:h-56",
}: DispatchRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    loadYmaps()
      .then((ymaps) => {
        if (disposed || !containerRef.current) return;
        const center = fromPoint ?? toPoint ?? { lat: 38.5598, lng: 68.7738 };
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [center.lat, center.lng],
            zoom: 13,
            controls: ["zoomControl"],
          },
          {
            yandexMapDisablePoiInteractivity: true,
            suppressMapOpenBlock: true,
          },
        );

        if (fromPoint) {
          const dot = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#0E8B60" stroke="white" stroke-width="2"/></svg>';
          map.geoObjects.add(new ymaps.Placemark(
            [fromPoint.lat, fromPoint.lng],
            { hintContent: "Аптека" },
            {
              iconLayout: "default#image",
              iconImageHref: "data:image/svg+xml," + encodeURIComponent(dot),
              iconImageSize: [16, 16],
              iconImageOffset: [-8, -8],
              hasBalloon: false,
            },
          ));
        }
        if (toPoint) {
          const dot = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#ef4444" stroke="white" stroke-width="2"/></svg>';
          map.geoObjects.add(new ymaps.Placemark(
            [toPoint.lat, toPoint.lng],
            { hintContent: "Клиент" },
            {
              iconLayout: "default#image",
              iconImageHref: "data:image/svg+xml," + encodeURIComponent(dot),
              iconImageSize: [16, 16],
              iconImageOffset: [-8, -8],
              hasBalloon: false,
            },
          ));
        }

        mapRef.current = map;
        setIsLoaded(true);
      })
      .catch(() => { /* fall through to placeholder */ });

    return () => {
      disposed = true;
      try { mapRef.current?.destroy(); } catch { /* ignore */ }
      mapRef.current = null;
    };
    // Coordinates are immutable per modal opening — no need to recreate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative w-full ${heightClassName}`}>
      {!isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
