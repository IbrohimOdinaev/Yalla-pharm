"use client";

import { useEffect, useRef, useState } from "react";
import { getGuestBasketPreview } from "@/entities/basket/api";
import type { ApiBasketPharmacyOption } from "@/shared/types/api";
import { useGuestCartStore } from "./guestCartStore";

/**
 * Returns pharmacy options for the guest cart so the UI can share the authenticated
 * best-price pill logic. Re-fetches when the set of (medicineId, quantity) pairs
 * actually changes — a plain `items` dep would fire on every store write.
 */
export function useGuestPharmacyOptions(): ApiBasketPharmacyOption[] {
  const items = useGuestCartStore((s) => s.items);
  const [options, setOptions] = useState<ApiBasketPharmacyOption[]>([]);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    if (items.length === 0) {
      if (options.length !== 0) setOptions([]);
      lastKeyRef.current = "";
      return;
    }

    const key = items
      .map((i) => `${i.medicineId}:${i.quantity}`)
      .sort()
      .join("|");
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    let cancelled = false;
    getGuestBasketPreview(items.map((i) => ({ medicineId: i.medicineId, quantity: i.quantity })))
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return options;
}
