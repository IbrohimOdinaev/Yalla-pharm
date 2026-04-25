"use client";

import { useEffect, useState } from "react";
import { getMapProvider } from "@/shared/lib/map";
import { stripPlusCode } from "@/shared/lib/map/jura-provider";

/** Module-level cache keyed by rounded "lat,lng" so a pharmacy resolved once
 * stays resolved for the rest of the session — no repeat Jura calls on
 * navigation or re-render. Rounding to 6 decimals keeps cache hits stable
 * across response noise. */
const cache = new Map<string, string>();

/** Reject raw coordinate strings — e.g. Google's fallback when no address
 * matches a point — so cards don't end up showing "38.564712, 68.762566". */
const COORDS_ONLY_RE = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;

function keyOf(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function looksLikeCoords(text: string): boolean {
  return COORDS_ONLY_RE.test(text.trim());
}

type Pharmacyish = {
  id: string;
  /** Address stored on the pharmacy record — typically "Plus Code, Street,
   * City". Used as a last-resort fallback when Jura can't resolve the point. */
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Resolve each pharmacy's coordinates to a human-readable Jura address.
 * Returns a map of `pharmacyId → resolved text`. Entries become available
 * asynchronously as lookups complete. Fallback chain:
 *   1. Jura reverseGeocode (via JuraMapProvider)
 *   2. Stored address with any Plus Code prefix stripped
 * Raw coordinate strings are always rejected so users never see lat/lng
 * pairs as a pharmacy's address. */
export function usePharmacyAddresses(
  pharmacies: ReadonlyArray<Pharmacyish>,
): Record<string, string> {
  const [state, setState] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of pharmacies) {
      if (typeof p.latitude !== "number" || typeof p.longitude !== "number") continue;
      const cached = cache.get(keyOf(p.latitude, p.longitude));
      if (cached) initial[p.id] = cached;
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    const jobs = pharmacies
      .filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number",
      )
      .map(async (p) => {
        const lat = p.latitude as number;
        const lng = p.longitude as number;
        const k = keyOf(lat, lng);

        const cached = cache.get(k);
        if (cached) return { id: p.id, address: cached };

        const storedFallback = stripPlusCode((p.address ?? "").trim()).trim();

        try {
          const result = await getMapProvider().reverseGeocode({ lat, lng });
          const text = (result?.address ?? "").trim();
          if (text && !looksLikeCoords(text)) {
            cache.set(k, text);
            return { id: p.id, address: text };
          }
        } catch {
          /* fall through to stored fallback */
        }

        if (storedFallback) {
          cache.set(k, storedFallback);
          return { id: p.id, address: storedFallback };
        }
        return null;
      });

    Promise.all(jobs).then((results) => {
      if (cancelled) return;
      const additions: Record<string, string> = {};
      for (const r of results) {
        if (r) additions[r.id] = r.address;
      }
      if (Object.keys(additions).length === 0) return;
      setState((prev) => ({ ...prev, ...additions }));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacies.map((p) => p.id).join("|")]);

  return state;
}
