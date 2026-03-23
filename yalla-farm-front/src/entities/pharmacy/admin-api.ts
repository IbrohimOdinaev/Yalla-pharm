import { apiFetch } from "@/shared/api/http-client";
import type { ActivePharmacy } from "@/entities/pharmacy/api";

export async function getAllPharmacies(token: string, query = "", page = 1, pageSize = 50): Promise<ActivePharmacy[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ pharmacies?: ActivePharmacy[] }>(`/api/pharmacies/all?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.pharmacies) ? response.pharmacies : [];
}

export async function updatePharmacy(
  token: string,
  data: { pharmacyId: string; adminId?: string; title: string; address: string; isActive: boolean }
): Promise<void> {
  await apiFetch<unknown>("/api/pharmacies", { method: "PUT", token, body: data });
}

export async function deletePharmacy(token: string, pharmacyId: string): Promise<void> {
  await apiFetch<unknown>("/api/pharmacies", { method: "DELETE", token, body: { pharmacyId } });
}
