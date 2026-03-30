/* eslint-disable @typescript-eslint/no-explicit-any */

import { env } from "@/shared/config/env";
import type { MapProvider, MapInstance, MapOptions, MapMarkerOptions, MapClickHandler, GeoPoint, GeoResult, SuggestItem } from "./types";

let loadPromise: Promise<any> | null = null;

function loadSdk(): Promise<any> {
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

class YandexMapInstance implements MapInstance {
  private map: any;
  private ymaps: any;

  constructor(map: any, ymaps: any) {
    this.map = map;
    this.ymaps = ymaps;
  }

  addMarker(options: MapMarkerOptions): void {
    const { YMapMarker } = this.ymaps;
    this.map.addChild(
      new YMapMarker(
        { coordinates: [options.coordinates.lng, options.coordinates.lat] },
        options.content
      )
    );
  }

  onClick(handler: MapClickHandler): void {
    const { YMapListener } = this.ymaps;
    const listener = new YMapListener({
      layer: "any",
      onClick: (_object: any, event: any) => {
        const coords = event?.coordinates;
        if (coords) handler({ lat: coords[1], lng: coords[0] });
      },
    });
    this.map.addChild(listener);
  }

  destroy(): void {
    this.map.destroy();
  }
}

export class YandexMapProvider implements MapProvider {
  async createMap(options: MapOptions): Promise<MapInstance> {
    const ymaps = await loadSdk();
    const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ymaps;

    const map = new YMap(options.container, {
      location: {
        center: [options.center.lng, options.center.lat],
        zoom: options.zoom,
      },
    });

    map.addChild(new YMapDefaultSchemeLayer({}));
    map.addChild(new YMapDefaultFeaturesLayer({}));

    return new YandexMapInstance(map, ymaps);
  }

  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    const apiKey = env.yandexMapsApiKey;
    if (!apiKey) return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };

    try {
      const url = `https://geocode-maps.yandex.ru/v1/?apikey=${apiKey}&geocode=${point.lng},${point.lat}&format=json&lang=ru_RU&results=1&kind=house`;
      const res = await fetch(url);
      const data = await res.json();
      const geoObject = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      const address = geoObject?.metaDataProperty?.GeocoderMetaData?.text
        ?? geoObject?.name
        ?? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      return { address, ...point };
    } catch {
      return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };
    }
  }

  async suggest(query: string, bbox = "68.65,38.50~68.90,38.65"): Promise<SuggestItem[]> {
    const apiKey = env.yandexMapsApiKey;
    if (!apiKey) return [];

    try {
      const encoded = encodeURIComponent(`Душанбе, ${query.trim()}`);
      const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${apiKey}&text=${encoded}&lang=ru&types=geo&print_address=1&bbox=${bbox}`;
      const res = await fetch(url);
      const data = await res.json();
      return (data?.results ?? []).map((r: any) => ({
        title: r.title?.text ?? "",
        subtitle: r.subtitle?.text ?? "",
      }));
    } catch {
      return [];
    }
  }

  async geocode(address: string): Promise<GeoPoint | null> {
    const apiKey = env.yandexMapsApiKey;
    if (!apiKey) return null;

    try {
      const encoded = encodeURIComponent(address);
      const url = `https://geocode-maps.yandex.ru/v1/?apikey=${apiKey}&geocode=${encoded}&format=json&lang=ru_RU&results=1`;
      const res = await fetch(url);
      const data = await res.json();
      const pos = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
      if (!pos) return null;
      const [lng, lat] = pos.split(" ").map(Number);
      return { lat, lng };
    } catch {
      return null;
    }
  }
}
