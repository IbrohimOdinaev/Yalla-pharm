"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayView, Marker } from "@react-google-maps/api";
import { env } from "@/shared/config/env";
import { DUSHANBE_CENTER, getMapProvider, type GeoPoint, type GeoResult } from "@/shared/lib/map";

const LIBRARIES: ("places")[] = ["places"];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
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
  const [isDragging, setIsDragging] = useState(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // For non-centerPin modes, center follows selectedPoint/userLocation
  const center = useMemo(() => {
    if (selectedPoint) return { lat: selectedPoint.lat, lng: selectedPoint.lng };
    if (userLocation) return { lat: userLocation.lat, lng: userLocation.lng };
    if (pharmacies.length > 0) return { lat: pharmacies[0].lat, lng: pharmacies[0].lng };
    return DUSHANBE_CENTER;
  }, [pharmacies, userLocation, selectedPoint]);


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
    // Debounce reverse geocode
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(async () => {
      const provider = getMapProvider();
      const result = await provider.reverseGeocode(point);
      if (result) onCenterChange(result);
    }, 300);
  }, [centerPinMode, onCenterChange]);

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
      {/* Center pin for drag-to-pick mode */}
      {centerPinMode && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center" style={{ marginBottom: 36 }}>
            {/* Pin shadow */}
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none" className={`transition-transform duration-150 ${isDragging ? "-translate-y-2 scale-110" : ""}`}>
              <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#0058bc" />
              <circle cx="20" cy="18" r="8" fill="white" />
              <circle cx="20" cy="18" r="4" fill="#0058bc" />
            </svg>
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={centerPinMode ? undefined : center}
        zoom={14}
        options={MAP_OPTIONS}
        onLoad={(map) => {
          mapRef.current = map;
          if (centerPinMode) {
            const initPos = selectedPoint
              ? { lat: selectedPoint.lat, lng: selectedPoint.lng }
              : userLocation
                ? { lat: userLocation.lat, lng: userLocation.lng }
                : DUSHANBE_CENTER;
            map.setCenter(initPos);
          }
          mapHandle?.({ panTo: (pt) => map.panTo({ lat: pt.lat, lng: pt.lng }) });
        }}
        onUnmount={() => { mapHandle?.(null); }}
        onClick={pickMode ? handleMapClick : undefined}
        onIdle={centerPinMode ? handleIdle : undefined}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      >
        {/* Pharmacy markers with name labels */}
        {pharmacies.map((pharmacy) => (
          <Marker
            key={pharmacy.id}
            position={{ lat: pharmacy.lat, lng: pharmacy.lng }}
            title={pharmacy.title}
            onClick={() => onPharmacyClick?.(pharmacy.id)}
            label={{ text: pharmacy.title, color: "#000", fontWeight: "bold", fontSize: "11px", className: "pharmacy-marker-label" }}
          />
        ))}

        {/* User location marker (green pin with "Вы" label) */}
        {userLocation && !centerPinMode && (
          <Marker
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
            title="Вы здесь"
            icon={{
              url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#16a34a"/><circle cx="16" cy="14" r="6" fill="white"/></svg>'),
              scaledSize: new google.maps.Size(32, 42),
              anchor: new google.maps.Point(16, 42),
            }}
            label={{ text: "Вы", color: "#fff", fontWeight: "bold", fontSize: "11px" }}
          />
        )}

        {/* Selected point marker (only in legacy pickMode) */}
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
