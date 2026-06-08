type RuntimeConfigKey =
  | "NEXT_PUBLIC_API_BASE_URL"
  | "NEXT_PUBLIC_SIGNALR_ENABLED"
  | "NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL"
  | "NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL"
  | "NEXT_PUBLIC_YANDEX_MAPS_API_KEY";

type RuntimeConfig = Partial<Record<RuntimeConfigKey, string>>;

declare global {
  interface Window {
    __YALLA_PHARM_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const buildTimeConfig: RuntimeConfig = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_SIGNALR_ENABLED: process.env.NEXT_PUBLIC_SIGNALR_ENABLED,
  NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL: process.env.NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL,
  NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL: process.env.NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL,
  NEXT_PUBLIC_YANDEX_MAPS_API_KEY: process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY,
};

export function getRuntimeConfigValue(key: RuntimeConfigKey, fallback = ""): string {
  if (typeof window !== "undefined") {
    const runtimeValue = window.__YALLA_PHARM_RUNTIME_CONFIG__?.[key];
    if (runtimeValue !== undefined) return runtimeValue || fallback;
  }

  return buildTimeConfig[key] ?? fallback;
}
