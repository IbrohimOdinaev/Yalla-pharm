"use client";

import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import { env } from "@/shared/config/env";
import type { GeoPoint } from "@/shared/lib/map";

const LIBRARIES: ("places")[] = ["places"];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

export type DispatchRouteMapProps = {
  fromPoint: GeoPoint | null;
  toPoint: GeoPoint | null;
  /** Tailwind height class for the map container (defaults to h-48 sm:h-56). */
  heightClassName?: string;
};

/** Google variant of the from→to mini-map used in DispatchDeliveryModal.
 *  Renders two pins (pharmacy + client). The wrapping modal owns the
 *  rounded-border container; this component only paints the map itself. */
export function DispatchRouteMapGoogle({
  fromPoint,
  toPoint,
  heightClassName = "h-48 sm:h-56",
}: DispatchRouteMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: env.googleMapsApiKey,
    libraries: LIBRARIES,
  });

  const center = fromPoint ?? toPoint ?? { lat: 38.5598, lng: 68.7738 };

  if (!isLoaded) {
    return (
      <div className={`w-full ${heightClassName} flex items-center justify-center bg-surface-container-low`}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName={`w-full ${heightClassName}`}
      center={center}
      zoom={13}
      options={MAP_OPTIONS}
    >
      {fromPoint && (
        <OverlayView position={fromPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div
            className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow-lg"
            style={{ transform: "translate(-50%, -50%)" }}
            title="Аптека"
          />
        </OverlayView>
      )}
      {toPoint && (
        <OverlayView position={toPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div
            className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg"
            style={{ transform: "translate(-50%, -50%)" }}
            title="Клиент"
          />
        </OverlayView>
      )}
    </GoogleMap>
  );
}
