export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000",
  signalRUpdatesHubUrl: process.env.NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL ?? "http://localhost:5000/hubs/updates"
} as const;
