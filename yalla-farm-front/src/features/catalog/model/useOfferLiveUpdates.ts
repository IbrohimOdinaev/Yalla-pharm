"use client";

import { useCallback } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useSignalREvent } from "@/shared/lib/useSignalR";

type OfferUpdatePayload = {
  medicineId: string;
  pharmacyId: string;
  price: number;
  stockQuantity: number;
};

type OfferUpdateCallback = (payload: OfferUpdatePayload) => void;

export function useOfferLiveUpdates(onUpdate: OfferUpdateCallback) {
  const token = useAppSelector((s) => s.auth.token);

  const handler = useCallback(
    (data: unknown) => {
      const payload = data as OfferUpdatePayload;
      if (payload?.medicineId) onUpdate(payload);
    },
    [onUpdate]
  );

  useSignalREvent("OfferUpdated", handler, token);
}
