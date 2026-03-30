export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  signalRUpdatesHubUrl: process.env.NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL ?? "/hubs/updates",
  yandexMapsApiKey: process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
} as const;
