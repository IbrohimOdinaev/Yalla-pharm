"use client";

import { env } from "@/shared/config/env";
import { DriverTrackingMapGoogle } from "./DriverTrackingMapGoogle";
import { DriverTrackingMapYandex } from "./DriverTrackingMapYandex";
import type { DriverTrackingMapProps } from "./DriverTrackingMapGoogle";

export function DriverTrackingMap(props: DriverTrackingMapProps) {
  if (env.mapProvider === "yandex") return <DriverTrackingMapYandex {...props} />;
  return <DriverTrackingMapGoogle {...props} />;
}

export type { DriverTrackingMapProps } from "./DriverTrackingMapGoogle";
