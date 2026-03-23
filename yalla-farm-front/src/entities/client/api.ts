import { apiFetch } from "@/shared/api/http-client";
import type { ApiClient } from "@/shared/types/api";

export async function getMyProfile(token: string): Promise<ApiClient> {
  const response = await apiFetch<{ client?: ApiClient }>("/api/clients/me", { token });
  if (!response?.client) throw new Error("Не удалось загрузить профиль.");
  return response.client;
}

export async function updateMyProfile(token: string, data: { name?: string; phoneNumber?: string }): Promise<void> {
  await apiFetch<unknown>("/api/clients/me", { method: "PUT", token, body: data });
}

export async function deleteMyAccount(token: string): Promise<void> {
  await apiFetch<unknown>("/api/clients/me", { method: "DELETE", token, body: {} });
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch<unknown>("/api/auth/change-password", {
    method: "POST",
    token,
    body: { currentPassword, newPassword }
  });
}
