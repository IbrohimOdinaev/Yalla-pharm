import { env } from "@/shared/config/env";

/* eslint-disable @typescript-eslint/no-explicit-any */

let loadPromise: Promise<any> | null = null;

export function loadYandexMaps(): Promise<any> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load Yandex Maps on server"));
      return;
    }

    if ((window as any).ymaps3) {
      (window as any).ymaps3.ready.then(() => resolve((window as any).ymaps3));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${env.yandexMapsApiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      const ymaps3 = (window as any).ymaps3;
      if (ymaps3) {
        ymaps3.ready.then(() => resolve(ymaps3));
      } else {
        reject(new Error("ymaps3 not available after script load"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Yandex Maps script"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Dushanbe center coordinates
export const DUSHANBE_CENTER = { lat: 38.5598, lng: 68.7738 } as const;

export type GeoResult = {
  address: string;
  lat: number;
  lng: number;
};

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const apiKey = env.yandexMapsApiKey;
  if (!apiKey) return { address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng };

  try {
    const url = `https://geocode-maps.yandex.ru/v1/?apikey=${apiKey}&geocode=${lng},${lat}&format=json&lang=ru_RU&results=1&kind=house`;
    const res = await fetch(url);
    const data = await res.json();
    const geoObject = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!geoObject) return { address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng };

    const address = geoObject.metaDataProperty?.GeocoderMetaData?.text
      ?? geoObject.name
      ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    return { address, lat, lng };
  } catch {
    return { address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng };
  }
}

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
