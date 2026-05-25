"use client";

/**
 * PharmacyMap entry-point. Rendering is handled by Yandex Maps for its
 * mature pan/zoom/tile pipeline, while address search/reverse geocode data
 * still flows through getMapProvider() where Mahal is the primary provider.
 */
export { PharmacyMapYandex as PharmacyMap } from "./PharmacyMapYandex";
export type { PharmacyMarker, PharmacyMapHandle, PharmacyMapProps } from "./PharmacyMapYandex";
