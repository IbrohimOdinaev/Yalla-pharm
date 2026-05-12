/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadYmaps } from "./yandex-loader";
import type {
  MapProvider,
  MapInstance,
  MapOptions,
  MapMarkerOptions,
  MapClickHandler,
  GeoPoint,
  GeoResult,
  SuggestItem,
} from "./types";

/**
 * YandexMapProvider — geocoding/suggest/reverse-geocoding via the
 * loaded Yandex Maps JS API v2 SDK (lat-first thanks to
 * `coordorder=latlong`). The SDK is shared with the map widgets via the
 * singleton loader, so this never adds a second `<script>` tag.
 *
 * `createMap()` is a noop adaptor preserved for the abstract MapProvider
 * interface — actual map rendering happens inside the React widgets.
 */
class YandexMapInstance implements MapInstance {
  addMarker(_options: MapMarkerOptions): void {
    /* widgets construct markers directly via the SDK — see PharmacyMapYandex. */
  }
  onClick(_handler: MapClickHandler): void { /* same as above */ }
  destroy(): void { /* same as above */ }
}

export class YandexMapProvider implements MapProvider {
  async createMap(_options: MapOptions): Promise<MapInstance> {
    await loadYmaps();
    return new YandexMapInstance();
  }

  /** Reverse-geocode coords → human-readable address using the SDK's
   *  built-in geocoder. Falls back to a "lat, lng" string when no result
   *  is returned, so the address picker always renders something. */
  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    try {
      const ymaps = await loadYmaps();
      const result = await ymaps.geocode([point.lat, point.lng], { results: 1 });
      const first = result.geoObjects.get(0);
      const address = first?.getAddressLine?.()
        ?? first?.properties?.get?.("text")
        ?? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      return { address, ...point };
    } catch {
      return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };
    }
  }

  /** Address suggestions — the SDK ships `ymaps.suggest()` which calls
   *  the same Suggest service the HTTP API does, but auth piggy-backs on
   *  the JS API key so it works on plans that don't expose the standalone
   *  Suggest HTTP product. */
  async suggest(query: string): Promise<SuggestItem[]> {
    if (!query.trim()) return [];
    try {
      const ymaps = await loadYmaps();
      // Bias the autocomplete toward Dushanbe so "Rudaki" doesn't get
      // hijacked by Russian Rudakovs.
      const results = await ymaps.suggest(`Душанбе, ${query}`, { results: 8 });
      return (results ?? []).map((r: any) => {
        const display: string = r.displayName ?? r.value ?? "";
        // displayName is "Title, Subtitle, ..." — split on the first comma
        // to mirror the Google variant's structured_formatting.
        const idx = display.indexOf(",");
        if (idx === -1) return { title: display, subtitle: "" };
        return {
          title: display.slice(0, idx).trim(),
          subtitle: display.slice(idx + 1).trim(),
        };
      });
    } catch {
      return [];
    }
  }

  /** Forward geocode an address string → lat/lng. Used when the user
   *  picks a Suggest result that doesn't carry coords inline. */
  async geocode(address: string): Promise<GeoPoint | null> {
    try {
      const ymaps = await loadYmaps();
      const result = await ymaps.geocode(address, { results: 1 });
      const first = result.geoObjects.get(0);
      const coords = first?.geometry?.getCoordinates?.();
      if (!Array.isArray(coords) || coords.length < 2) return null;
      // coordorder=latlong → [lat, lng] from the SDK.
      return { lat: coords[0], lng: coords[1] };
    } catch {
      return null;
    }
  }
}
