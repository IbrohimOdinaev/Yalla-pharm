import { apiFetch } from "@/shared/api/http-client";

export type ApiAdmin = {
  adminId: string;
  name: string;
  phoneNumber: string;
  pharmacyId?: string;
  pharmacyTitle?: string;
};

export async function getAdmins(token: string, query = "", page = 1, pageSize = 50): Promise<ApiAdmin[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ admins?: ApiAdmin[] }>(`/api/admins?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.admins) ? response.admins : [];
}

export async function updateAdminMe(token: string, data: { name: string; phoneNumber: string }): Promise<void> {
  await apiFetch<unknown>("/api/admins/me", { method: "PUT", token, body: data });
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
