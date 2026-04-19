import { apiFetch } from "@/shared/api/http-client";
import type { ApiClient } from "@/shared/types/api";

export async function getMyProfile(token: string): Promise<ApiClient> {
  const response = await apiFetch<{ client?: ApiClient }>("/api/clients/me", { token });
  if (!response?.client) throw new Error("Не удалось загрузить профиль.");
  return response.client;
}

export async function updateMyProfile(token: string, data: { name?: string; gender?: number | null; dateOfBirth?: string | null }): Promise<void> {
  // phoneNumber intentionally not forwarded — it only changes via the OTP link flow.
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

/* ── Profile linking: phone ── */

export type PhoneLinkOtpResponse = {
  otpSessionId: string;
  phoneNumber: string;
  expiresAtUtc: string;
  resendAvailableAtUtc?: string;
  codeLength: number;
};

export async function requestPhoneLink(token: string, phoneNumber: string): Promise<PhoneLinkOtpResponse> {
  return apiFetch<PhoneLinkOtpResponse>("/api/clients/me/phone/link/request", {
    method: "POST",
    token,
    body: { phoneNumber },
  });
}

export async function verifyPhoneLink(token: string, otpSessionId: string, code: string): Promise<ApiClient> {
  const response = await apiFetch<{ userId: string; name: string; phoneNumber: string; accessToken: string }>(
    "/api/clients/me/phone/link/verify",
    { method: "POST", token, body: { otpSessionId, code } }
  );
  return { clientId: response.userId, name: response.name, phoneNumber: response.phoneNumber };
}

/* ── Profile linking: telegram ── */

export type TelegramLinkStartResponse = {
  nonce: string;
  deepLink: string;
  botUsername: string;
  expiresAtUtc: string;
  ttlSeconds: number;
};

export async function startTelegramLink(token: string): Promise<TelegramLinkStartResponse> {
  return apiFetch<TelegramLinkStartResponse>("/api/clients/me/telegram/link/start", {
    method: "POST",
    token,
    body: {},
  });
}

export async function pollTelegramLink(token: string, nonce: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/clients/me/telegram/link/poll?nonce=${encodeURIComponent(nonce)}`, { token });
}

export async function completeTelegramLink(token: string, nonce: string): Promise<void> {
  await apiFetch<unknown>("/api/clients/me/telegram/link/complete", {
    method: "POST",
    token,
    body: { nonce },
  });
}

/* ── Profile: saved delivery addresses ── */

export type ClientAddress = {
  id: string;
  address: string;
  title?: string | null;
  latitude: number;
  longitude: number;
  lastUsedAtUtc: string;
  createdAtUtc: string;
};

export async function getMyAddresses(token: string): Promise<ClientAddress[]> {
  const response = await apiFetch<{ addresses?: ClientAddress[] }>("/api/clients/me/addresses", { token });
  return Array.isArray(response?.addresses) ? response.addresses : [];
}

export async function upsertMyAddress(
  token: string,
  body: { address: string; title?: string | null; latitude: number; longitude: number }
): Promise<ClientAddress> {
  return apiFetch<ClientAddress>("/api/clients/me/addresses", { method: "POST", token, body });
}

export async function updateMyAddress(
  token: string,
  addressId: string,
  body: { title?: string | null; address?: string; latitude?: number; longitude?: number; clearTitle?: boolean }
): Promise<ClientAddress> {
  return apiFetch<ClientAddress>(`/api/clients/me/addresses/${addressId}`, { method: "PUT", token, body });
}

export async function deleteMyAddress(token: string, addressId: string): Promise<void> {
  await apiFetch<unknown>(`/api/clients/me/addresses/${addressId}`, { method: "DELETE", token, body: {} });
}
