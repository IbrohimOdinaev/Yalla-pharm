"use client";

import { useCallback } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { useCartStore } from "@/features/cart/model/cartStore";

export function useBasketLive() {
  const token = useAppSelector((s) => s.auth.token);
  const loadBasket = useCartStore((s) => s.loadBasket);

  const handler = useCallback(
    () => {
      if (token) loadBasket(token).catch(() => undefined);
    },
    [token, loadBasket]
  );

  useSignalREvent("BasketUpdated", handler, token);
}
