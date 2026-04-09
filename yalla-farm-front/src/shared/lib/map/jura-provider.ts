import type { MapProvider, MapInstance, MapOptions, GeoPoint, GeoResult, SuggestItem } from "./types";
import { searchAddress, type AddressSuggestion } from "@/shared/api/address";

export class JuraMapProvider implements MapProvider {
  private readonly _mapDelegate: MapProvider;
  private _lastSuggestions: AddressSuggestion[] = [];
  private _lastSelected: AddressSuggestion | null = null;

  constructor(mapDelegate: MapProvider) {
    this._mapDelegate = mapDelegate;
  }

  async suggest(query: string): Promise<SuggestItem[]> {
    const results = await searchAddress(query);
    this._lastSuggestions = results;
    return results.map((r) => ({
      title: r.title,
      subtitle: r.address !== r.title ? r.address : undefined,
    }));
  }

  async geocode(address: string): Promise<GeoPoint | null> {
    const match = this._lastSuggestions.find((s) => {
      const full = s.address !== s.title ? `${s.title}, ${s.address}` : s.title;
      return full === address || s.title === address || s.address === address;
    });
    if (match) {
      this._lastSelected = match;
      return { lat: match.lat, lng: match.lng };
    }

    this._lastSelected = null;
    return this._mapDelegate.geocode(address);
  }

  getLastSelectedSuggestion(): AddressSuggestion | null {
    return this._lastSelected;
  }

  createMap(options: MapOptions): Promise<MapInstance> {
    return this._mapDelegate.createMap(options);
  }

  reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    return this._mapDelegate.reverseGeocode(point);
  }
}
