import { apiFetch } from "@/shared/api/http-client";

export type ApiAdmin = {
  adminId: string;
  name: string;
  phoneNumber: string;
  pharmacyId?: string;
  pharmacyTitle?: string;
  avatarUrl?: string | null;
};

export type AdminProfileOtpResponse = {
  otpSessionId: string;
  phoneNumber: string;
  expiresAtUtc: string;
  resendAvailableAtUtc: string;
  codeLength: number;
};

export async function getAdmins(token: string, query = "", page = 1, pageSize = 50): Promise<ApiAdmin[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ admins?: ApiAdmin[] }>(`/api/admins?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.admins) ? response.admins : [];
}

export async function updateAdminMe(token: string, data: { name: string; phoneNumber: string }): Promise<void> {
  await apiFetch<unknown>("/api/admins/me", { method: "PUT", token, body: data });
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

export async function createAdmin(token: string, data: { name: string; phoneNumber: string; password: string; pharmacyId?: string }): Promise<void> {
  await apiFetch<unknown>("/api/admins/register", { method: "POST", token, body: data });
}

export async function createAdminWithPharmacy(
  token: string,
  data: { adminName: string; adminPhoneNumber: string; adminPassword: string; pharmacyTitle: string; pharmacyAddress: string }
): Promise<void> {
  await apiFetch<unknown>("/api/admins/register-with-pharmacy", { method: "POST", token, body: data });
}

export async function deleteAdmin(token: string, pharmacyWorkerId: string): Promise<void> {
  await apiFetch<unknown>("/api/admins", { method: "DELETE", token, body: { pharmacyWorkerId } });
}

export async function getAdminMe(token: string): Promise<{name: string; phoneNumber: string; avatarUrl?: string | null}> {
  const response = await apiFetch<{name?: string; phoneNumber?: string; avatarUrl?: string | null}>("/api/admins/me", { token, method: "GET" });
  return { name: response?.name ?? "", phoneNumber: response?.phoneNumber ?? "", avatarUrl: response?.avatarUrl ?? null };
}
