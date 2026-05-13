"use client";

import { env } from "@/shared/config/env";
import { PharmacyMapGoogle } from "./PharmacyMapGoogle";
import { PharmacyMapYandex } from "./PharmacyMapYandex";
import type { PharmacyMapProps } from "./PharmacyMapGoogle";

/**
 * Provider switch — picks the active map renderer at runtime based on
 * `NEXT_PUBLIC_MAP_PROVIDER`. Both implementations share the same
 * props contract (PharmacyMapProps) so the swap is invisible to call
 * sites. Google is kept as a fallback path while the Yandex migration
 * is being validated; once everything's verified we'll drop the Google
 * variant + the @react-google-maps/api dep in a separate cleanup pass.
 */
export function PharmacyMap(props: PharmacyMapProps) {
  if (env.mapProvider === "yandex") return <PharmacyMapYandex {...props} />;
  return <PharmacyMapGoogle {...props} />;
}

export type { PharmacyMarker, PharmacyMapHandle, PharmacyMapProps } from "./PharmacyMapGoogle";
