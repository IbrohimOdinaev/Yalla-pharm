"use client";

import { useCallback } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useSignalREvent } from "@/shared/lib/useSignalR";

type OrderStatusPayload = {
  orderId: string;
  status: string;
  clientId?: string;
  pharmacyId?: string;
};

type OrderStatusCallback = (payload: OrderStatusPayload) => void;

export function useOrderStatusLive(onUpdate: OrderStatusCallback) {
  const token = useAppSelector((s) => s.auth.token);

  const handler = useCallback(
    (data: unknown) => {
      const payload = data as OrderStatusPayload;
      if (payload?.orderId) onUpdate(payload);
    },
    [onUpdate]
  );

  useSignalREvent("OrderStatusChanged", handler, token);
}
