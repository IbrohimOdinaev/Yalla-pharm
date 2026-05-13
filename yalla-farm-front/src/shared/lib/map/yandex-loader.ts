/* eslint-disable @typescript-eslint/no-explicit-any */

import { env } from "@/shared/config/env";

/**
 * Singleton loader for Yandex Maps API v2.1 (the legacy `ymaps` global,
 * not v3's `ymaps3`). v2 is what our current API key works with — v3
 * requires a separate key from the «JavaScript API v3» product slot in
 * the Yandex Cloud / Developer Console.
 *
 * Returns the same Promise on every call so concurrent map widgets
 * share a single `<script>` injection. Resolves with the global
 * `window.ymaps` once `ymaps.ready` has fired.
 *
 * Used by the Yandex variants of PharmacyMap / DriverTrackingMap /
 * DispatchRouteMap *and* by YandexMapProvider, so the geocoder / Suggest
 * service don't double-load the SDK while a map is also rendering.
 */
let loadPromise: Promise<any> | null = null;

export function loadYmaps(): Promise<any> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load Yandex Maps on server"));
      return;
    }

    const win = window as unknown as { ymaps?: any };
    if (win.ymaps) {
      win.ymaps.ready(() => resolve(win.ymaps));
      return;
    }

    const apiKey = env.yandexMapsApiKey;
    if (!apiKey) {
      reject(new Error("NEXT_PUBLIC_YANDEX_MAPS_API_KEY is not configured."));
      return;
    }

    // Reuse a tag if one's already in the DOM (StrictMode in dev mounts
    // twice; we don't want a duplicate src and a duplicate `ymaps` global).
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-yandex-maps="v2"]',
    );
    const script = existing ?? document.createElement("script");
    if (!existing) {
      // `coordorder=latlong` flips the SDK to lat-first ordering across
      // every API surface (constructors, events, geocode, suggest), so the
      // rest of the codebase keeps treating GeoPoint as { lat, lng } without
      // having to remember Yandex's default lon-first convention.
      script.src =
        `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU&coordorder=latlong`;
      script.async = true;
      script.dataset.yandexMaps = "v2";
      document.head.appendChild(script);
    }

    const onLoad = () => {
      const ymaps = (window as unknown as { ymaps?: any }).ymaps;
      if (ymaps) {
        ymaps.ready(() => resolve(ymaps));
      } else {
        reject(new Error("ymaps not available after script load"));
      }
    };

    if (existing && (window as unknown as { ymaps?: any }).ymaps) {
      onLoad();
      return;
    }

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Yandex Maps script")),
      { once: true },
    );
  });

  return loadPromise;
}

// Back-compat alias for the v3 name used by call sites added during the
// short-lived v3 attempt — keeps the import sites untouched.
export const loadYmaps3 = loadYmaps;
