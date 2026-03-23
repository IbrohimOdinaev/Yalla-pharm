import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { env } from "@/shared/config/env";

let connection: HubConnection | null = null;

export async function ensureSignalRConnection(accessToken?: string | null): Promise<HubConnection | null> {
  if (typeof window === "undefined") return null;

  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl(env.signalRUpdatesHubUrl, {
        accessTokenFactory: () => accessToken ?? ""
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000])
      .configureLogging(LogLevel.Warning)
      .build();
  }

  if (connection.state === HubConnectionState.Connected || connection.state === HubConnectionState.Connecting) {
    return connection;
  }

  try {
    await connection.start();
    return connection;
  } catch {
    return null;
  }
}
