import type { MapProvider, MapInstance, MapOptions, GeoPoint, GeoResult, SuggestItem } from "./types";
import { searchAddress, type AddressSuggestion } from "@/shared/api/address";

/**
 * Jura map provider — wraps Google/Yandex for map tiles & native geocoding,
 * but **replaces user-facing address text with Jura data** wherever possible:
 *  - `suggest` → direct call to Jura /api/address/search (autocomplete dropdown)
 *  - `geocode` → lookup in last Jura suggestions; falls back to Google if no match
 *  - `reverseGeocode` → asks Google first, strips Plus Codes, then queries Jura
 *    with the cleaned text to surface a human-readable Jura address. User's pin
 *    coords are preserved (we don't snap to Jura's point) so map interaction
 *    stays natural.
 */

// Plus Code (Open Location Code) — what Google returns for points without a
// matching street address. Looks like "HRH4+MC6" or "8FVC9G8F+". We strip this
// token so the user never sees it.
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,7}\+[23456789CFGHJMPQRVWX]{0,4},?\s*/i;

function stripPlusCode(text: string): string {
  return text.replace(PLUS_CODE_RE, "").trim();
}

function hasPlusCode(text: string): boolean {
  return PLUS_CODE_RE.test(text);
}

function formatSuggestion(s: AddressSuggestion): string {
  const title = (s.title ?? "").trim();
  const address = (s.address ?? "").trim();
  if (title && address && title !== address) return `${title}, ${address}`;
  return title || address;
}

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
      const full = formatSuggestion(s);
      return full === address || s.title === address || s.address === address;
    });
    if (match) {
      this._lastSelected = match;
      return { lat: match.lat, lng: match.lng };
    }

    this._lastSelected = null;
    return this._mapDelegate.geocode(address);
  }

  /**
   * Resolve a pin coordinate to a Jura-styled address text.
   *
   * Strategy:
   *  1. Call base provider (Google) reverseGeocode to get raw text.
   *  2. Strip any Plus Code tokens from it — user must never see "HRH4+MC6".
   *  3. Use cleaned text as a query to Jura's `/api/address/search` and take
   *     the best match for display (title + address). User's pin coords are
   *     preserved so the map doesn't jump.
   *  4. If Jura returns nothing, fall back to cleaned Google text, then to
   *     a coord string.
   */
  async reverseGeocode(point: GeoPoint): Promise<GeoResult | null> {
    const googleResult = await this._mapDelegate.reverseGeocode(point);
    const rawText = googleResult?.address ?? "";
    const cleanedText = stripPlusCode(rawText);
    const coordFallback = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

    // 2-char minimum protects Jura's search from wasteful calls.
    if (cleanedText.length >= 2) {
      try {
        const suggestions = await searchAddress(cleanedText);
        if (suggestions.length > 0) {
          const match = suggestions[0];
          this._lastSelected = match;
          return {
            address: formatSuggestion(match) || cleanedText,
            ...point,
          };
        }
      } catch {
        /* ignore — fall through to cleaned Google text */
      }
    }

    // No Jura hit → use cleaned Google text, or coords if Google gave only a Plus Code.
    this._lastSelected = null;
    const display =
      cleanedText && !hasPlusCode(cleanedText)
        ? cleanedText
        : coordFallback;
    return { address: display, ...point };
  }

  getLastSelectedSuggestion(): AddressSuggestion | null {
    return this._lastSelected;
  }

  createMap(options: MapOptions): Promise<MapInstance> {
    return this._mapDelegate.createMap(options);
  }
}
