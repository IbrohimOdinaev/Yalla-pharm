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

// Normalize a longitude into the canonical [-180, 180] window. Google Maps
// allows the user to drag past the date line, after which `center.lng()`
// returns un-wrapped values (e.g. 2068 after several wraps). Any caller that
// forwards these to backend / reverseGeocode would get nonsense coords —
// always fold the value back before exposing it.
function normalizeLng(lng: number): number {
  if (!Number.isFinite(lng)) return 0;
  // ((lng + 180) mod 360 + 360) mod 360 - 180 — branchless for both signs.
  const wrapped = ((lng + 180) % 360 + 360) % 360 - 180;
  return wrapped;
}

// Latitude doesn't wrap (the world doesn't loop top-to-bottom on a 2D map),
// so just clamp to the valid Mercator range. Anything beyond means the point
// already came in broken — clamp avoids cascading NaN / 400s downstream.
function clampLat(lat: number): number {
  if (!Number.isFinite(lat)) return 0;
  if (lat > 90) return 90;
  if (lat < -90) return -90;
  return lat;
}

function normalizePoint(point: GeoPoint): GeoPoint {
  return { lat: clampLat(point.lat), lng: normalizeLng(point.lng) };
}

export class GoogleMapProvider implements MapProvider {
  async createMap(_options: MapOptions): Promise<MapInstance> {
    return new GoogleMapInstance();
  }

  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    await waitForGoogleMaps();

    // Always normalise — the input may come from a freshly-dragged map that
    // hasn't wrapped its lng. Returning `...point` later then exposes the
    // safe value to callers (delivery/calculate, JURA search, etc.).
    const safe = normalizePoint(point);

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat: safe.lat, lng: safe.lng },
      });

      const results = response.results ?? [];
      if (results.length === 0) {
        return { address: `${safe.lat.toFixed(6)}, ${safe.lng.toFixed(6)}`, ...safe };
      }

      // Google returns several candidates (street → neighbourhood → city → country,
      // plus a Plus Code near the start). We prefer anything that is NOT a Plus
      // Code — the Jura provider will do its own cleanup, but this is a safer
      // raw input for it.
      const plusCodeRe = /^[23456789CFGHJMPQRVWX]{4,7}\+[23456789CFGHJMPQRVWX]{0,4}/i;
      const streetLike = results.find((r) => !plusCodeRe.test(r.formatted_address));

      return { address: (streetLike ?? results[0]).formatted_address, ...safe };
    } catch {
      return { address: `${safe.lat.toFixed(6)}, ${safe.lng.toFixed(6)}`, ...safe };
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

      return normalizePoint({ lat: location.lat(), lng: location.lng() });
    } catch {
      return null;
    }
  }
}

// Re-export the normalisers — also useful from PharmacyMap when it reads
// raw map.getCenter() values before forwarding to onCenterChange.
export { normalizeLng, clampLat, normalizePoint };
