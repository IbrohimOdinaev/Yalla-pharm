import { getRuntimeConfigValue } from "./runtime-config";

function getBooleanRuntimeConfigValue(key: Parameters<typeof getRuntimeConfigValue>[0], fallback: boolean): boolean {
  const raw = getRuntimeConfigValue(key, fallback ? "true" : "false").trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(raw);
}

export const env = {
  apiBaseUrl: getRuntimeConfigValue("NEXT_PUBLIC_API_BASE_URL"),
  signalREnabled: getBooleanRuntimeConfigValue("NEXT_PUBLIC_SIGNALR_ENABLED", true),
  signalRUpdatesHubUrl: getRuntimeConfigValue("NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL", "/hubs/updates"),
  signalRTelegramAuthHubUrl: getRuntimeConfigValue(
    "NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL",
    "/hubs/telegram-auth",
  ),
  yandexMapsApiKey: getRuntimeConfigValue("NEXT_PUBLIC_YANDEX_MAPS_API_KEY"),
  siteUrl: getRuntimeConfigValue("NEXT_PUBLIC_SITE_URL"),
} as const;

/**
 * Critical → throws. Optional → console.warn. Called from a top-level
 * script (`scripts/validate-env.mjs`) before `next build` and once at
 * runtime from the StoreProvider so SSR + the browser bundle share the
 * same guarantees.
 *
 * Two valid networking modes — at least one must be configured:
 *   1. INTERNAL_API_URL (server-only) → next.config.ts proxies /api/*
 *      and /hubs/* server-side. Browser uses relative URLs, no CORS.
 *   2. NEXT_PUBLIC_API_BASE_URL → bakes absolute API host into the
 *      client bundle for direct cross-origin calls (needs CORS).
 * Both being set is fine; the public var wins at runtime.
 */
export function validateEnv(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const internalApiUrl = process.env.INTERNAL_API_URL ?? "";

  if (env.apiBaseUrl && !/^https?:\/\//.test(env.apiBaseUrl)) {
    errors.push(
      `NEXT_PUBLIC_API_BASE_URL must be an absolute URL (got "${env.apiBaseUrl}").`,
    );
  }

  if (env.siteUrl && !/^https?:\/\//.test(env.siteUrl)) {
    errors.push(
      `NEXT_PUBLIC_SITE_URL must be an absolute URL (got "${env.siteUrl}").`,
    );
  }

  if (internalApiUrl && !/^https?:\/\//.test(internalApiUrl)) {
    errors.push(
      `INTERNAL_API_URL must be an absolute URL (got "${internalApiUrl}").`,
    );
  }

  if (!env.apiBaseUrl && !internalApiUrl) {
    errors.push(
      "Neither INTERNAL_API_URL nor NEXT_PUBLIC_API_BASE_URL is set — every fetch will hit a relative path with no upstream and 404.",
    );
  }

  if (!env.yandexMapsApiKey) {
    warnings.push(
      "NEXT_PUBLIC_YANDEX_MAPS_API_KEY is empty. Maps will render an error placeholder.",
    );
  }

  if (env.signalREnabled && (!env.signalRUpdatesHubUrl || !env.signalRTelegramAuthHubUrl)) {
    warnings.push(
      "SignalR hub URLs missing; realtime cart / Telegram-auth flows will be disabled.",
    );
  }

  return { errors, warnings };
}
