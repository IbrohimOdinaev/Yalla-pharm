import type { MapProvider, MapInstance, MapOptions, GeoPoint, GeoResult, SuggestItem } from "./types";

type MahalSuggestion = SuggestItem & GeoPoint;

const COORD_LIKE_RE = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;

function isCoordString(text: string): boolean {
  return COORD_LIKE_RE.test(text);
}

function formatSuggestion(s: SuggestItem) {
  return s.subtitle ? `${s.title}, ${s.subtitle}` : s.title;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Mahal proxy failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export class MahalMapProvider implements MapProvider {
  private readonly _mapDelegate: MapProvider;
  private _lastSuggestions: MahalSuggestion[] = [];
  private _lastSelected: MahalSuggestion | null = null;

  constructor(mapDelegate: MapProvider) {
    this._mapDelegate = mapDelegate;
  }

  async suggest(query: string): Promise<SuggestItem[]> {
    const text = query.trim();
    if (text.length < 2 || isCoordString(text)) {
      this._lastSuggestions = [];
      return [];
    }

    try {
      const results = await readJson<MahalSuggestion[]>(
        `/api/map/mahal/search?text=${encodeURIComponent(text)}&limit=8`,
      );
      this._lastSuggestions = results;
      return results.map(({ title, subtitle, lat, lng }) => ({ title, subtitle, lat, lng }));
    } catch {
      this._lastSuggestions = [];
      return this._mapDelegate.suggest(query);
    }
  }

  async geocode(address: string): Promise<GeoPoint | null> {
    const match = this._lastSuggestions.find((s) => {
      const full = formatSuggestion(s);
      return full === address || s.title === address;
    });
    if (match) {
      this._lastSelected = match;
      return { lat: match.lat, lng: match.lng };
    }

    try {
      const results = await readJson<MahalSuggestion[]>(
        `/api/map/mahal/search?text=${encodeURIComponent(address)}&limit=1`,
      );
      const first = results[0];
      if (first) {
        this._lastSelected = first;
        return { lat: first.lat, lng: first.lng };
      }
    } catch {
      /* fall through to map delegate */
    }

    this._lastSelected = null;
    return this._mapDelegate.geocode(address);
  }

  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    try {
      const result = await readJson<GeoResult | null>(
        `/api/map/mahal/reverse?lat=${encodeURIComponent(String(point.lat))}&lng=${encodeURIComponent(String(point.lng))}`,
      );
      if (result) {
        this._lastSelected = null;
        return result;
      }
    } catch {
      /* fall through to map delegate */
    }

    return this._mapDelegate.reverseGeocode(point);
  }

  getLastSelectedSuggestion(): MahalSuggestion | null {
    return this._lastSelected;
  }

  createMap(options: MapOptions): Promise<MapInstance> {
    return this._mapDelegate.createMap(options);
  }
}
