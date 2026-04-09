import { apiFetch } from "@/shared/api/http-client";
import type { ActivePharmacy } from "@/entities/pharmacy/api";

export async function getAllPharmacies(token: string, query = "", page = 1, pageSize = 50): Promise<ActivePharmacy[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ pharmacies?: ActivePharmacy[] }>(`/api/pharmacies/all?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.pharmacies) ? response.pharmacies : [];
}

export async function updatePharmacy(
  token: string,
  data: { pharmacyId: string; adminId?: string; title: string; address: string; isActive: boolean; latitude?: number; longitude?: number; iconUrl?: string }
): Promise<void> {
  await apiFetch<unknown>("/api/pharmacies", { method: "PUT", token, body: data });
}

export async function deletePharmacy(token: string, pharmacyId: string): Promise<void> {
  await apiFetch<unknown>("/api/pharmacies", { method: "DELETE", token, body: { pharmacyId } });
}

export async function uploadPharmacyIcon(token: string, pharmacyId: string, file: File): Promise<string> {
  const { env } = await import("@/shared/config/env");
  const formData = new FormData();
  formData.append("pharmacyId", pharmacyId);
  formData.append("image", file);
  const response = await fetch(`${env.apiBaseUrl}/api/pharmacies/icon`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error("Не удалось загрузить иконку.");
  const data = await response.json();
  return data.iconUrl ?? "";
}

export async function deletePharmacyIcon(token: string, pharmacyId: string): Promise<void> {
  await apiFetch<unknown>("/api/pharmacies/icon", { method: "DELETE", token, body: { pharmacyId } });
}

export function pharmacyIconUrl(pharmacyId: string): string {
  // Lazy import to avoid circular dependency
  return `/api/pharmacies/icon/${pharmacyId}/content`;
}
