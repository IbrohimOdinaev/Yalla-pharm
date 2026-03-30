"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getMapProvider, DUSHANBE_CENTER, type GeoPoint, type GeoResult, type MapInstance } from "@/shared/lib/map";

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
  userLocation?: GeoPoint | null;
  selectedPoint?: GeoPoint | null;
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
  const mapInstanceRef = useRef<MapInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const handleMapClick = useCallback(async (point: GeoPoint) => {
    if (!onMapClickRef.current) return;
    const provider = getMapProvider();
    const result = await provider.reverseGeocode(point);
    if (result) onMapClickRef.current(result);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    const provider = getMapProvider();

    const center = pharmacies.length > 0
      ? { lat: pharmacies[0].lat, lng: pharmacies[0].lng }
      : DUSHANBE_CENTER;

    provider
      .createMap({ container: containerRef.current!, center, zoom: 13 })
      .then((mapInstance) => {
        if (destroyed) { mapInstance.destroy(); return; }

        // Click handler for pick mode
        if (pickMode) {
          mapInstance.onClick(handleMapClick);
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
          mapInstance.addMarker({ coordinates: { lat: pharmacy.lat, lng: pharmacy.lng }, content: el });
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
          mapInstance.addMarker({ coordinates: userLocation, content: userEl });
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
          mapInstance.addMarker({ coordinates: selectedPoint, content: pickEl });
        }

        mapInstanceRef.current = mapInstance;
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
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
