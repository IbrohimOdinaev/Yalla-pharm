"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from "react";
import { loadYandexMaps, reverseGeocode, DUSHANBE_CENTER, type GeoResult } from "@/shared/lib/yandex-maps";

export type PharmacyMarker = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
};

type PharmacyMapProps = {
  pharmacies: PharmacyMarker[];
  className?: string;
  onPharmacyClick?: (id: string) => void;
  onMapClick?: (result: GeoResult) => void;
  userLocation?: { lat: number; lng: number } | null;
  selectedPoint?: { lat: number; lng: number } | null;
  pickMode?: boolean;
};

export function PharmacyMap({
  pharmacies,
  className = "",
  onPharmacyClick,
  onMapClick,
  userLocation,
  selectedPoint,
  pickMode = false,
}: PharmacyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pickMarkerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ymapsRef = useRef<any>(null);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const handleMapClick = useCallback(async (object: any, event: any) => {
    if (!onMapClickRef.current) return;
    const coords = event?.coordinates;
    if (!coords) return;
    const [lng, lat] = coords;
    const result = await reverseGeocode(lat, lng);
    if (result) onMapClickRef.current(result);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    loadYandexMaps()
      .then(async (ymaps: any) => {
        if (destroyed || !containerRef.current) return;
        ymapsRef.current = ymaps;

        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapListener } = ymaps;

        const center: [number, number] = pharmacies.length > 0
          ? [pharmacies[0].lng, pharmacies[0].lat]
          : [DUSHANBE_CENTER.lng, DUSHANBE_CENTER.lat];

        const map = new YMap(containerRef.current!, {
          location: { center, zoom: 13 },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        // Click listener for picking points
        if (pickMode) {
          const listener = new YMapListener({ layer: "any", onClick: handleMapClick });
          map.addChild(listener);
        }

        // Pharmacy markers
        for (const pharmacy of pharmacies) {
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="
              background: #0057ff; color: white;
              padding: 4px 10px; border-radius: 20px;
              font-size: 11px; font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              cursor: pointer;
              transform: translate(-50%, -100%);
            ">${pharmacy.title}</div>
          `;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onPharmacyClick?.(pharmacy.id);
          });
          map.addChild(new YMapMarker({ coordinates: [pharmacy.lng, pharmacy.lat] }, el));
        }

        // User location marker
        if (userLocation) {
          const userEl = document.createElement("div");
          userEl.innerHTML = `
            <div style="
              width: 16px; height: 16px;
              background: #34c759; border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              transform: translate(-50%, -50%);
            "></div>
          `;
          map.addChild(new YMapMarker({ coordinates: [userLocation.lng, userLocation.lat] }, userEl));
        }

        // Selected point marker
        if (selectedPoint) {
          const pickEl = document.createElement("div");
          pickEl.innerHTML = `
            <div style="
              width: 20px; height: 20px;
              background: #ff3b30; border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              transform: translate(-50%, -50%);
            "></div>
          `;
          const marker = new YMapMarker({ coordinates: [selectedPoint.lng, selectedPoint.lat] }, pickEl);
          map.addChild(marker);
          pickMarkerRef.current = marker;
        }

        mapRef.current = map;
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!destroyed) {
          setError(err.message || "Не удалось загрузить карту");
          setLoading(false);
        }
      });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [pharmacies, userLocation, selectedPoint, onPharmacyClick, pickMode, handleMapClick]);

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant p-6 ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-low">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {pickMode && !loading && (
        <div className="absolute top-2 left-2 z-20 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
          Нажмите на карту для выбора точки
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
