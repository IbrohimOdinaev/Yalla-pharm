import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { env } from "@/shared/config/env";

export type TelegramAuthHubHandlers = {
  onConfirmed: () => void;
  onCancelled?: () => void;
};

/**
 * Connects to the anonymous Telegram-auth SignalR hub and subscribes to the
 * given nonce. Returns the connection so the caller can stop() it later.
 */
export async function connectTelegramAuthHub(
  nonce: string,
  handlers: TelegramAuthHubHandlers,
): Promise<HubConnection> {
  const url = env.signalRTelegramAuthHubUrl.startsWith("http")
    ? env.signalRTelegramAuthHubUrl
    : `${env.apiBaseUrl}${env.signalRTelegramAuthHubUrl}`;

  const conn = new HubConnectionBuilder()
    .withUrl(url)
    .withAutomaticReconnect([0, 1000, 3000, 5000])
    .configureLogging(LogLevel.Warning)
    .build();

  conn.on("TelegramAuthConfirmed", () => handlers.onConfirmed());
  conn.on("TelegramAuthCancelled", () => handlers.onCancelled?.());

  await conn.start();
  await conn.invoke("SubscribeAsync", nonce);
  return conn;
}
