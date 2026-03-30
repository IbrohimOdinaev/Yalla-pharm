/* eslint-disable @typescript-eslint/no-explicit-any */

import { env } from "@/shared/config/env";
import type { MapProvider, MapInstance, MapOptions, MapMarkerOptions, MapClickHandler, GeoPoint, GeoResult, SuggestItem } from "./types";

let loadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load Google Maps on server"));
      return;
    }

    if ((window as any).google?.maps) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${env.googleMapsApiKey}&libraries=places,marker&language=ru&region=TJ`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

class GoogleMapInstance implements MapInstance {
  private map: google.maps.Map;
  private markers: google.maps.marker.AdvancedMarkerElement[] = [];

  constructor(map: google.maps.Map) {
    this.map = map;
  }

  addMarker(options: MapMarkerOptions): void {
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: this.map,
      position: { lat: options.coordinates.lat, lng: options.coordinates.lng },
      content: options.content,
    });
    this.markers.push(marker);
  }

  onClick(handler: MapClickHandler): void {
    this.map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        handler({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    });
  }

  destroy(): void {
    for (const marker of this.markers) {
      marker.map = null;
    }
    this.markers = [];
  }
}

export class GoogleMapProvider implements MapProvider {
  async createMap(options: MapOptions): Promise<MapInstance> {
    await loadSdk();

    const map = new google.maps.Map(options.container, {
      center: { lat: options.center.lat, lng: options.center.lng },
      zoom: options.zoom,
      mapId: "yalla-farm-map",
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });

    return new GoogleMapInstance(map);
  }

  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    await loadSdk();

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat: point.lat, lng: point.lng },
      });

      const result = response.results?.[0];
      if (!result) return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };

      return { address: result.formatted_address, ...point };
    } catch {
      return { address: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, ...point };
    }
  }

  async suggest(query: string): Promise<SuggestItem[]> {
    await loadSdk();

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
    await loadSdk();

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
