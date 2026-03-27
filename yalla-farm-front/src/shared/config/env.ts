export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  // SignalR: use relative path (proxied via Next.js rewrites, falls back to Long Polling)
  // For direct WebSocket, set NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL=http://localhost:5000/hubs/updates
  signalRUpdatesHubUrl: process.env.NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL ?? "/hubs/updates"
} as const;
