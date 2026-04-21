/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MapProvider, MapInstance, MapOptions, GeoPoint, GeoResult, SuggestItem } from "./types";

/**
 * Google Maps provider — used for geocoding, suggestions, and reverse geocoding.
 * Map rendering is handled by @react-google-maps/api components (PharmacyMap, DriverTrackingMap).
 * The SDK is loaded by useJsApiLoader in those components, so we just wait for google.maps to be available.
 */

function waitForGoogleMaps(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).google?.maps) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if ((window as any).google?.maps) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

// createMap is kept for interface compatibility but should not be used directly.
// Use <GoogleMap> from @react-google-maps/api instead.
class GoogleMapInstance implements MapInstance {
  addMarker(): void { /* noop */ }
  onClick(): void { /* noop */ }
  destroy(): void { /* noop */ }
}

export class GoogleMapProvider implements MapProvider {
  async createMap(_options: MapOptions): Promise<MapInstance> {
    return new GoogleMapInstance();
  }

  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    await waitForGoogleMaps();

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat: point.lat, lng: point.lng },
      });

      const results = response.results ?? [];
      if (results.length === 0) {
        return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };
      }

      // Google returns several candidates (street → neighbourhood → city → country,
      // plus a Plus Code near the start). We prefer anything that is NOT a Plus
      // Code — the Jura provider will do its own cleanup, but this is a safer
      // raw input for it.
      const plusCodeRe = /^[23456789CFGHJMPQRVWX]{4,7}\+[23456789CFGHJMPQRVWX]{0,4}/i;
      const streetLike = results.find((r) => !plusCodeRe.test(r.formatted_address));

      return { address: (streetLike ?? results[0]).formatted_address, ...point };
    } catch {
      return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };
    }
  }

  async suggest(query: string): Promise<SuggestItem[]> {
    await waitForGoogleMaps();

    try {
      const service = new google.maps.places.AutocompleteService();
      const response = await service.getPlacePredictions({
        input: `Душанбе, ${query}`,
        componentRestrictions: { country: "tj" },
        types: ["geocode", "establishment"],
      });

      return (response.predictions ?? []).map((p) => ({
        title: p.structured_formatting?.main_text ?? p.description,
        subtitle: p.structured_formatting?.secondary_text ?? "",
      }));
    } catch {
      return [];
    }
  }

  async geocode(address: string): Promise<GeoPoint | null> {
    await waitForGoogleMaps();

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ address });

      const location = response.results?.[0]?.geometry?.location;
      if (!location) return null;

      return { lat: location.lat(), lng: location.lng() };
    } catch {
      return null;
    }
  }
}
