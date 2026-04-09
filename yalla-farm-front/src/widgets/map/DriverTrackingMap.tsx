"use client";

import { useEffect, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import { env } from "@/shared/config/env";
import type { GeoPoint } from "@/shared/lib/map";
import { getDriverPosition } from "@/shared/api/delivery";

const LIBRARIES: ("places")[] = ["places"];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

type Props = {
  token: string;
  orderId: string;
  fromPoint: GeoPoint;
  toPoint: GeoPoint;
  className?: string;
};

export function DriverTrackingMap({ token, orderId, fromPoint, toPoint, className = "" }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: env.googleMapsApiKey,
    libraries: LIBRARIES,
  });

  const [driverPos, setDriverPos] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      while (active) {
        try {
          const pos = await getDriverPosition(token, orderId);
          if (active) {
            setDriverPos({ lat: pos.lat, lng: pos.lng });
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
  }, [token, orderId]);

  if (!isLoaded) {
    return (
      <div className={className}>
        <div className="w-full h-48 xs:h-56 sm:h-64 rounded-xl overflow-hidden flex items-center justify-center bg-surface-container-low">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <GoogleMap
        mapContainerClassName="w-full h-48 xs:h-56 sm:h-64 rounded-xl overflow-hidden"
        center={fromPoint}
        zoom={13}
        options={MAP_OPTIONS}
      >
        {/* From point */}
        <OverlayView position={fromPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div className="w-3 h-3 rounded-full bg-primary border-2 border-white shadow" style={{ transform: "translate(-50%, -50%)" }} />
        </OverlayView>

        {/* To point */}
        <OverlayView position={toPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" style={{ transform: "translate(-50%, -50%)" }} />
        </OverlayView>

        {/* Driver position */}
        {driverPos && (
          <OverlayView position={driverPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg animate-pulse" style={{ transform: "translate(-50%, -50%)" }} />
          </OverlayView>
        )}
      </GoogleMap>
      {error ? <p className="mt-1 text-xs text-on-surface-variant">{error}</p> : null}
    </div>
  );
}
