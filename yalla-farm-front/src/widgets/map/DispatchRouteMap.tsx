"use client";

import { env } from "@/shared/config/env";
import { DispatchRouteMapGoogle } from "./DispatchRouteMapGoogle";
import { DispatchRouteMapYandex } from "./DispatchRouteMapYandex";
import type { DispatchRouteMapProps } from "./DispatchRouteMapGoogle";

export function DispatchRouteMap(props: DispatchRouteMapProps) {
  if (env.mapProvider === "yandex") return <DispatchRouteMapYandex {...props} />;
  return <DispatchRouteMapGoogle {...props} />;
}

export type { DispatchRouteMapProps } from "./DispatchRouteMapGoogle";
