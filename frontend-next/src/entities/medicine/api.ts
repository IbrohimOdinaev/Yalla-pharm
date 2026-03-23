import { apiFetch } from "@/shared/api/http-client";
import type { ApiMedicine, ApiPaginated } from "@/shared/types/api";

export async function getCatalogMedicines(page = 1, pageSize = 24): Promise<ApiMedicine[]> {
  const response = await apiFetch<ApiPaginated<ApiMedicine>>(`/api/medicines?page=${page}&pageSize=${pageSize}`);
  return Array.isArray(response?.medicines) ? response.medicines : [];
}

export async function getMedicineById(id: string): Promise<ApiMedicine> {
  const response = await apiFetch<{ medicine?: ApiMedicine }>(`/api/medicines/${id}`);
  if (!response?.medicine) {
    throw new Error("Товар не найден.");
  }

  return response.medicine;
}

export function resolveMedicineImageUrl(medicine?: ApiMedicine): string {
  const firstImage = medicine?.images?.[0];
  if (!firstImage) return "";
  if (firstImage.url) return firstImage.url;
  if (firstImage.id) return `/api/medicines/images/${firstImage.id}/content`;
  return "";
}

export function getMedicineDisplayName(medicine: ApiMedicine): string {
  return medicine.title || medicine.name || "Без названия";
}
