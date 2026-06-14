"use client";

import { useEffect, useRef } from "react";
import { ensureSignalRConnection } from "@/shared/lib/signalr";
import type { HubConnection } from "@microsoft/signalr";

type EventHandler = (...args: unknown[]) => void;

export function useSignalREvent(
  eventName: string,
  handler: EventHandler,
  token: string | null
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!token) return;

    let connection: HubConnection | null = null;
    let wrappedHandler: EventHandler | null = null;
    let mounted = true;

    ensureSignalRConnection(token).then((conn) => {
      if (!mounted || !conn) return;
      connection = conn;
      wrappedHandler = (...args: unknown[]) => handlerRef.current(...args);
      connection.on(eventName, wrappedHandler);
    });

    return () => {
      mounted = false;
      if (connection && wrappedHandler) {
        connection.off(eventName, wrappedHandler);
      }
    };
  }, [eventName, token]);
}
