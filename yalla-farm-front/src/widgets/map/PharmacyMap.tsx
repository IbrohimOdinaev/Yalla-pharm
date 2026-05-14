"use client";

/**
 * PharmacyMap entry-point. Used to switch between Google + Yandex
 * implementations at runtime; the Google variant has been retired and
 * Yandex is now the only renderer, so this file is a thin re-export to
 * keep call sites stable.
 */
export { PharmacyMapYandex as PharmacyMap } from "./PharmacyMapYandex";
export type { PharmacyMarker, PharmacyMapHandle, PharmacyMapProps } from "./PharmacyMapYandex";
