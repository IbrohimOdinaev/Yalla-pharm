import { apiFetch } from "@/shared/api/http-client";
import type { ApiClient } from "@/shared/types/api";

export async function getClients(token: string, query = "", page = 1, pageSize = 50): Promise<ApiClient[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ clients?: ApiClient[] }>(`/api/clients?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.clients) ? response.clients : [];
}

export async function deleteClient(token: string, clientId: string): Promise<void> {
  await apiFetch<unknown>("/api/clients", { method: "DELETE", token, body: { clientId } });
}
