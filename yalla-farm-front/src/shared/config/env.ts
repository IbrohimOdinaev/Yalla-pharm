export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  signalRUpdatesHubUrl: process.env.NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL ?? "/hubs/updates",
  signalRTelegramAuthHubUrl: process.env.NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL ?? "/hubs/telegram-auth",
  yandexMapsApiKey: process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
} as const;

/**
 * Critical → throws. Optional → console.warn. Called from a top-level
 * script (`scripts/validate-env.mjs`) before `next build` and once at
 * runtime from the StoreProvider so SSR + the browser bundle share the
 * same guarantees.
 */
export function validateEnv(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.apiBaseUrl) {
    errors.push(
      "NEXT_PUBLIC_API_BASE_URL is empty. Set it to the API host (e.g. https://yalla-pharm-1.onrender.com) — without it every fetch will hit the relative path on the front host and 404.",
    );
  } else if (!/^https?:\/\//.test(env.apiBaseUrl)) {
    errors.push(
      `NEXT_PUBLIC_API_BASE_URL must be an absolute URL (got "${env.apiBaseUrl}").`,
    );
  }

  if (!env.googleMapsApiKey) {
    warnings.push(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is empty. Pharmacy map + address picker will fall back to a placeholder.",
    );
  }

  if (!env.signalRUpdatesHubUrl || !env.signalRTelegramAuthHubUrl) {
    warnings.push(
      "SignalR hub URLs missing; realtime cart / Telegram-auth flows will be disabled.",
    );
  }

  return { errors, warnings };
}

