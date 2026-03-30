export type { MapProvider, MapInstance, MapOptions, MapMarkerOptions, MapClickHandler, GeoPoint, GeoResult, SuggestItem } from "./types";

import type { MapProvider } from "./types";
import { YandexMapProvider } from "./yandex-provider";

// Change this line to switch to a different map provider (e.g. GoogleMapProvider, LeafletMapProvider)
let _provider: MapProvider | null = null;

export function getMapProvider(): MapProvider {
  if (!_provider) {
    _provider = new YandexMapProvider();
  }
  return _provider;
}

// Dushanbe center
export const DUSHANBE_CENTER = { lat: 38.5598, lng: 68.7738 } as const;

// Browser geolocation (provider-agnostic)
export function getBrowserGeolocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Геолокация не поддерживается браузером"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error("Доступ к геолокации отклонён"));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error("Местоположение недоступно"));
            break;
          default:
            reject(new Error("Не удалось определить местоположение"));
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
