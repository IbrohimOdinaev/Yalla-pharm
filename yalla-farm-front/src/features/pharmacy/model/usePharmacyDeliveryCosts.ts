"use client";

import { useEffect, useState } from "react";
import { calculateDelivery } from "@/shared/api/delivery";

export type DeliveryCostState =
  | { state: "loading" }
  | { state: "ready"; cost: number; distance: number }
  | { state: "error" };

/** Cached Jura delivery-cost lookups keyed by `${pharmacyId}:${lat},${lng}`.
 * Keeps the pharmacy picker snappy when the user reopens it without changing
 * their delivery address. */
const cache = new Map<string, DeliveryCostState>();

function cacheKey(pharmacyId: string, lat: number, lng: number): string {
  return `${pharmacyId}:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

type Coords = { lat: number; lng: number };

/** Fetch Jura-calculated delivery cost from each pharmacy to the user's
 * chosen address, in parallel. Results arrive asynchronously; consumers
 * render a skeleton while `state === "loading"`.
 *
 * When `enabled` is false (pickup mode or no saved address), the hook
 * returns an empty map without making any API calls. */
export function usePharmacyDeliveryCosts(
  pharmacyIds: ReadonlyArray<string>,
  userCoords: Coords | null,
  userAddress: string,
  enabled: boolean,
): Record<string, DeliveryCostState> {
  const [state, setState] = useState<Record<string, DeliveryCostState>>({});

  useEffect(() => {
    if (!enabled || !userCoords || pharmacyIds.length === 0) {
      setState({});
      return;
    }

    let cancelled = false;

    // Seed state from cache + mark missing entries as loading in one pass
    // so cards render skeletons immediately rather than blank.
    const seed: Record<string, DeliveryCostState> = {};
    for (const id of pharmacyIds) {
      const k = cacheKey(id, userCoords.lat, userCoords.lng);
      const hit = cache.get(k);
      seed[id] = hit ?? { state: "loading" };
    }
    setState(seed);

    const pending = pharmacyIds.filter(
      (id) => !cache.has(cacheKey(id, userCoords.lat, userCoords.lng)),
    );

    for (const id of pending) {
      const k = cacheKey(id, userCoords.lat, userCoords.lng);
      calculateDelivery({
        pharmacyId: id,
        toTitle: userAddress,
        toAddress: userAddress,
        toLatitude: userCoords.lat,
        toLongitude: userCoords.lng,
      })
        .then((res) => {
          const value: DeliveryCostState = {
            state: "ready",
            cost: res.deliveryCost,
            distance: res.distance,
          };
          cache.set(k, value);
          if (!cancelled) setState((prev) => ({ ...prev, [id]: value }));
        })
        .catch(() => {
          const value: DeliveryCostState = { state: "error" };
          cache.set(k, value);
          if (!cancelled) setState((prev) => ({ ...prev, [id]: value }));
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    userCoords?.lat,
    userCoords?.lng,
    userAddress,
    pharmacyIds.join("|"),
  ]);

  return state;
}
