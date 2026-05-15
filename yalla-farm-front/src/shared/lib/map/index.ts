export type { MapProvider, MapInstance, MapOptions, MapMarkerOptions, MapClickHandler, GeoPoint, GeoResult, SuggestItem } from "./types";

import type { MapProvider } from "./types";
import { YandexMapProvider } from "./yandex-provider";
import { JuraMapProvider } from "./jura-provider";

let _provider: JuraMapProvider | null = null;

export function getMapProvider(): MapProvider {
  // Yandex is the only supported provider; the Google variant was
  // retired together with the @react-google-maps/api dep.
  if (!_provider) {
    _provider = new JuraMapProvider(new YandexMapProvider());
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
// Every click on "Определить моё местоположение" must give the browser a
// fresh chance to decide. We deliberately do NOT pre-gate with the
// Permissions API: its cached state can lag behind the user toggling
// geolocation in site settings, and a stale "denied" verdict would let
// us refuse the call locally even when the browser is now willing to
// prompt. Instead, we always invoke getCurrentPosition; the browser
// shows its native prompt when state is "prompt", returns coords when
// "granted", or rejects when "denied" — and we map that rejection to a
// typed GeolocationFailure below so callers can render the right UI:
// "permission-denied" gets a rich how-to-unblock hint, the other kinds
// just a one-liner.

export type GeolocationFailureKind =
  | "unsupported"
  | "permission-denied"
  | "unavailable"
  | "unknown";

export class GeolocationFailure extends Error {
  kind: GeolocationFailureKind;
  constructor(kind: GeolocationFailureKind, message: string) {
    super(message);
    this.name = "GeolocationFailure";
    this.kind = kind;
  }
}

export async function getBrowserGeolocation(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) {
    throw new GeolocationFailure(
      "unsupported",
      "Геолокация не поддерживается этим браузером.",
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(
              new GeolocationFailure(
                "permission-denied",
                "Доступ к геолокации заблокирован в браузере.",
              ),
            );
            break;
          case err.POSITION_UNAVAILABLE:
            reject(
              new GeolocationFailure(
                "unavailable",
                "Местоположение недоступно. Проверьте, включена ли геолокация на устройстве.",
              ),
            );
            break;
          default:
            reject(
              new GeolocationFailure(
                "unknown",
                "Не удалось определить местоположение. Попробуйте ещё раз.",
              ),
            );
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
