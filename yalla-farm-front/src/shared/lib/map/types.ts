export type GeoPoint = {
  lat: number;
  lng: number;
};

export type GeoResult = {
  address: string;
  lat: number;
  lng: number;
};

export type SuggestItem = {
  title: string;
  subtitle?: string;
};

export type MapMarkerOptions = {
  coordinates: GeoPoint;
  content: HTMLElement;
};

export type MapOptions = {
  container: HTMLElement;
  center: GeoPoint;
  zoom: number;
};

export type MapClickHandler = (point: GeoPoint) => void;

export interface MapInstance {
  addMarker(options: MapMarkerOptions): void;
  onClick(handler: MapClickHandler): void;
  destroy(): void;
}

export interface MapProvider {
  createMap(options: MapOptions): Promise<MapInstance>;
  reverseGeocode(point: GeoPoint): Promise<GeoResult | null>;
  suggest(query: string, bbox?: string): Promise<SuggestItem[]>;
  geocode(address: string): Promise<GeoPoint | null>;
}
