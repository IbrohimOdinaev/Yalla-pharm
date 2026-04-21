import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { env } from "@/shared/config/env";

// We keep a single shared connection, but rebuild it whenever the auth token
// changes. The SignalR client captures its `accessTokenFactory` once at build
// time, so a stale token would otherwise follow the connection across login
// and logout, producing silent 401s on WebSocket upgrade.
let connection: HubConnection | null = null;
let connectionToken: string | null = null;
let currentAccessToken: string | null = null;

function build(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(env.signalRUpdatesHubUrl, {
      // Read the latest token lazily on every negotiate / WebSocket upgrade.
      accessTokenFactory: () => currentAccessToken ?? "",
    })
    .withAutomaticReconnect([0, 1000, 3000, 5000])
    .configureLogging(LogLevel.Warning)
    .build();
}

export async function ensureSignalRConnection(accessToken?: string | null): Promise<HubConnection | null> {
  if (typeof window === "undefined") return null;

  // Hub is [Authorize]-gated; without a token the backend returns 401 on every
  // WebSocket handshake and retries flood the console. Bail early for guests.
  if (!accessToken) {
    await stopSignalRConnection();
    return null;
  }

  currentAccessToken = accessToken;

  // Token changed → the existing connection is using a stale auth header via its
  // closure. Tear it down and rebuild so the next negotiate picks up the new token.
  if (connection && connectionToken && connectionToken !== accessToken) {
    await stopSignalRConnection();
  }

  if (!connection) {
    connection = build();
    connectionToken = accessToken;
  }

  if (connection.state === HubConnectionState.Connected || connection.state === HubConnectionState.Connecting) {
    return connection;
  }

  try {
    await connection.start();
    return connection;
  } catch {
    // Leave the connection instance around so a later retry can start it;
    // callers already handle the null return gracefully.
    return null;
  }
}

export async function stopSignalRConnection(): Promise<void> {
  if (!connection) return;
  try {
    await connection.stop();
  } catch {
    /* connection may already be stopped or in the middle of starting */
  }
  connection = null;
  connectionToken = null;
  currentAccessToken = null;
}
