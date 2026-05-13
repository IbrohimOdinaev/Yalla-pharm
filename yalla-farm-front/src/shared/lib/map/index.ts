export type { MapProvider, MapInstance, MapOptions, MapMarkerOptions, MapClickHandler, GeoPoint, GeoResult, SuggestItem } from "./types";

import type { MapProvider } from "./types";
import { env } from "@/shared/config/env";
import { GoogleMapProvider } from "./google-provider";
import { YandexMapProvider } from "./yandex-provider";
import { JuraMapProvider } from "./jura-provider";

let _provider: JuraMapProvider | null = null;

export function getMapProvider(): MapProvider {
  if (!_provider) {
    // env.mapProvider is the source of truth — flip
    // NEXT_PUBLIC_MAP_PROVIDER to switch the geocoder/suggester used by
    // the address picker without touching call sites. Falls back to the
    // other provider if its key is missing.
    const useYandex = env.mapProvider === "yandex" || !env.googleMapsApiKey;
    const baseProvider = useYandex && env.yandexMapsApiKey
      ? new YandexMapProvider()
      : env.googleMapsApiKey
        ? new GoogleMapProvider()
        : new YandexMapProvider();
    _provider = new JuraMapProvider(baseProvider);
  }
  return _provider;
}

export function getLastSelectedAddress() {
  return _provider?.getLastSelectedSuggestion() ?? null;
}

// Dushanbe center
export const DUSHANBE_CENTER = { lat: 38.5598, lng: 68.7738 } as const;

// Browser geolocation (provider-agnostic).
//
// Behaviour we want: every click on the "Определить моё местоположение"
// button should retry the request, so a user who initially blocked geolocation
// can enable it in browser settings and have the very next click succeed.
//
// The hard browser rule we can't bend: once the user dismisses the native
// permission prompt with "Block", subsequent `getCurrentPosition` calls are
// silently rejected with PERMISSION_DENIED — the page can't force the prompt
// to appear again. So we use the Permissions API (when available) to detect
// that state up front and surface an actionable message that tells the user
// what to do, instead of a vague "denied" line.
export async function getBrowserGeolocation(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) {
    throw new Error("Геолокация не поддерживается этим браузером.");
  }

  // Best-effort pre-check via Permissions API. Not in every browser (Safari iOS
  // doesn't implement it for "geolocation"), so we silently fall through on any
  // error and let getCurrentPosition handle things itself.
  if (typeof navigator !== "undefined" && navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      if (status.state === "denied") {
        throw new Error(
          "Доступ к геолокации заблокирован в браузере. Откройте настройки сайта (значок замка слева от адреса) и разрешите геолокацию, затем нажмите кнопку снова."
        );
      }
    } catch (e) {
      // Re-throw our own actionable error; swallow native API quirks otherwise.
      if (e instanceof Error && e.message.startsWith("Доступ к геолокации заблокирован")) throw e;
    }
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(
              new Error(
                "Доступ к геолокации заблокирован в браузере. Откройте настройки сайта (значок замка слева от адреса) и разрешите геолокацию, затем нажмите кнопку снова."
              )
            );
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error("Местоположение недоступно. Проверьте, включена ли геолокация на устройстве."));
            break;
          default:
            reject(new Error("Не удалось определить местоположение. Попробуйте ещё раз."));
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
