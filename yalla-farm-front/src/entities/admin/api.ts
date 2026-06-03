import { apiFetch } from "@/shared/api/http-client";
import type { StaffCompensationSummary } from "@/entities/staff-compensation/api";

export type ApiAdmin = {
  adminId: string;
  name: string;
  phoneNumber: string;
  pharmacyId?: string;
  pharmacyTitle?: string;
  avatarUrl?: string | null;
  compensation?: StaffCompensationSummary | null;
};

export type ApiPharmacyWorkerResponse = {
  id: string;
  name: string;
  phoneNumber: string;
  avatarUrl?: string | null;
  pharmacyId: string;
};

export type CreateAdminWithPharmacyResponse = {
  pharmacyWorker: ApiPharmacyWorkerResponse;
  pharmacy: {
    id: string;
    title: string;
    address: string;
    isActive?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    iconUrl?: string | null;
    bannerUrl?: string | null;
  };
};

export type AdminProfileOtpResponse = {
  otpSessionId: string;
  phoneNumber: string;
  expiresAtUtc: string;
  resendAvailableAtUtc: string;
  codeLength: number;
};

export type StaffTelegramRecipient = {
  id: string;
  telegramUserId: number;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
  isActive: boolean;
  createdAtUtc: string;
};

export type StaffTelegramLinkStartResponse = {
  nonce: string;
  deepLink: string;
  appDeepLink?: string;
  webDeepLink?: string;
  botUsername: string;
  expiresAtUtc: string;
  ttlSeconds: number;
};

export async function getAdmins(token: string, query = "", page = 1, pageSize = 50): Promise<ApiAdmin[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ admins?: ApiAdmin[] }>(`/api/admins?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.admins) ? response.admins : [];
}

export async function updateAdminMe(token: string, data: { name: string; phoneNumber: string }): Promise<ApiAdmin> {
  return apiFetch<ApiAdmin>("/api/admins/me", { method: "PUT", token, body: data });
}

export async function requestAdminProfileOtp(
  token: string,
  data: { name: string; phoneNumber: string },
): Promise<AdminProfileOtpResponse> {
  return apiFetch<AdminProfileOtpResponse>("/api/admins/me/otp/request", { method: "POST", token, body: data });
}

export async function verifyAdminProfileOtp(
  token: string,
  data: { otpSessionId: string; code: string },
): Promise<ApiAdmin> {
  return apiFetch<ApiAdmin>("/api/admins/me/otp/verify", { method: "POST", token, body: data });
}

export async function uploadAdminAvatar(token: string, file: File): Promise<{ avatarUrl: string }> {
  const body = new FormData();
  body.append("image", file);
  return apiFetch<{ avatarUrl: string }>("/api/admins/me/avatar", { method: "POST", token, body });
}

export async function uploadAdminAvatarForSuperAdmin(token: string, adminId: string, file: File): Promise<{ avatarUrl: string }> {
  const body = new FormData();
  body.append("image", file);
  return apiFetch<{ avatarUrl: string }>(`/api/admins/${adminId}/avatar`, { method: "POST", token, body });
}

export async function createAdmin(token: string, data: { name: string; phoneNumber: string; password: string; pharmacyId?: string }): Promise<{ pharmacyWorker: ApiPharmacyWorkerResponse }> {
  return apiFetch<{ pharmacyWorker: ApiPharmacyWorkerResponse }>("/api/admins/register", { method: "POST", token, body: data });
}

export async function createAdminWithPharmacy(
  token: string,
  data: {
    adminName: string;
    adminPhoneNumber: string;
    adminPassword: string;
    pharmacyTitle: string;
    pharmacyAddress: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<CreateAdminWithPharmacyResponse> {
  return apiFetch<CreateAdminWithPharmacyResponse>("/api/admins/register-with-pharmacy", { method: "POST", token, body: data });
}

export async function deleteAdmin(token: string, pharmacyWorkerId: string): Promise<void> {
  await apiFetch<unknown>("/api/admins", { method: "DELETE", token, body: { pharmacyWorkerId } });
}

export async function getAdminMe(token: string): Promise<{name: string; phoneNumber: string; avatarUrl?: string | null}> {
  const response = await apiFetch<{name?: string; phoneNumber?: string; avatarUrl?: string | null}>("/api/admins/me", { token, method: "GET" });
  return { name: response?.name ?? "", phoneNumber: response?.phoneNumber ?? "", avatarUrl: response?.avatarUrl ?? null };
}

export async function getAdminTelegramRecipients(token: string): Promise<StaffTelegramRecipient[]> {
  const response = await apiFetch<{ recipients?: StaffTelegramRecipient[] }>("/api/admins/me/telegram/recipients", { token });
  return Array.isArray(response.recipients) ? response.recipients : [];
}

export async function startAdminTelegramLink(token: string): Promise<StaffTelegramLinkStartResponse> {
  return apiFetch<StaffTelegramLinkStartResponse>("/api/admins/me/telegram/link/start", { method: "POST", token });
}

export async function pollAdminTelegramLink(token: string, nonce: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/admins/me/telegram/link/poll?nonce=${encodeURIComponent(nonce)}`, { token });
}

export async function completeAdminTelegramLink(token: string, nonce: string): Promise<StaffTelegramRecipient> {
  return apiFetch<StaffTelegramRecipient>("/api/admins/me/telegram/link/complete", {
    method: "POST",
    token,
    body: { nonce },
  });
}

export async function deleteAdminTelegramRecipient(token: string, recipientId: string): Promise<void> {
  await apiFetch<unknown>(`/api/admins/me/telegram/recipients/${encodeURIComponent(recipientId)}`, {
    method: "DELETE",
    token,
  });
}

export async function getSuperAdminTelegramRecipients(token: string): Promise<StaffTelegramRecipient[]> {
  const response = await apiFetch<{ recipients?: StaffTelegramRecipient[] }>("/api/superadmin/telegram/recipients", { token });
  return Array.isArray(response.recipients) ? response.recipients : [];
}

export async function startSuperAdminTelegramLink(token: string): Promise<StaffTelegramLinkStartResponse> {
  return apiFetch<StaffTelegramLinkStartResponse>("/api/superadmin/telegram/link/start", { method: "POST", token });
}

export async function pollSuperAdminTelegramLink(token: string, nonce: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/superadmin/telegram/link/poll?nonce=${encodeURIComponent(nonce)}`, { token });
}

export async function completeSuperAdminTelegramLink(token: string, nonce: string): Promise<StaffTelegramRecipient> {
  return apiFetch<StaffTelegramRecipient>("/api/superadmin/telegram/link/complete", {
    method: "POST",
    token,
    body: { nonce },
  });
}

export async function deleteSuperAdminTelegramRecipient(token: string, recipientId: string): Promise<void> {
  await apiFetch<unknown>(`/api/superadmin/telegram/recipients/${encodeURIComponent(recipientId)}`, {
    method: "DELETE",
    token,
  });
}
