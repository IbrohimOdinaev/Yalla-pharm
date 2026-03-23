"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/shared/api/http-client";
import { ensureSignalRConnection } from "@/shared/lib/signalr";
import type { ApiPaymentIntentByIdResponse } from "@/shared/types/api";

type LiveState = {
  data: ApiPaymentIntentByIdResponse | null;
  isLoading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 4000;

export function usePaymentIntentLiveState(paymentIntentId: string | null, token: string | null) {
  const [state, setState] = useState<LiveState>({
    data: null,
    isLoading: Boolean(paymentIntentId),
    error: null
  });

  const canRun = useMemo(() => Boolean(paymentIntentId && token), [paymentIntentId, token]);

  useEffect(() => {
    if (!canRun || !paymentIntentId || !token) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    let isCancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let unsubscribeSignalR: (() => void) | null = null;

    const runFetch = async () => {
      try {
        const response = await apiFetch<ApiPaymentIntentByIdResponse>(`/api/clients/payment-intents/${paymentIntentId}`, {
          token
        });

        if (!isCancelled) {
          setState({ data: response, isLoading: false, error: null });
        }
      } catch (error) {
        if (!isCancelled) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : "Не удалось обновить статус оплаты."
          }));
        }
      }
    };

    runFetch().catch(() => undefined);

    pollTimer = setInterval(() => {
      runFetch().catch(() => undefined);
    }, POLL_INTERVAL_MS);

    ensureSignalRConnection(token)
      .then((connection) => {
        if (!connection) return;

        const handler = () => {
          runFetch().catch(() => undefined);
        };

        connection.on("PaymentIntentUpdated", handler);
        unsubscribeSignalR = () => connection.off("PaymentIntentUpdated", handler);
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (unsubscribeSignalR) unsubscribeSignalR();
    };
  }, [canRun, paymentIntentId, token]);

  return state;
}
