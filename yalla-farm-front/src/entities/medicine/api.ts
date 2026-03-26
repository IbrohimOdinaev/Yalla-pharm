import { apiFetch } from "@/shared/api/http-client";
import { env } from "@/shared/config/env";
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

/** Get image URL by image object */
export function imageUrl(img?: { id?: string; url?: string }): string {
  if (!img) return "";
  if (img.url) return img.url;
  if (img.id) return `${env.apiBaseUrl}/api/medicines/images/${img.id}/content`;
  return "";
}

/** Minimal image (for catalog grid thumbnails) */
export function getMinimalImageUrl(medicine?: ApiMedicine): string {
  const images = medicine?.images ?? [];
  const minimal = images.find((i) => i.isMinimal);
  if (minimal) return imageUrl(minimal);
  const main = images.find((i) => i.isMain);
  if (main) return imageUrl(main);
  return imageUrl(images[0]);
}

/** Main image (for product detail hero) */
export function getMainImageUrl(medicine?: ApiMedicine): string {
  const images = medicine?.images ?? [];
  const main = images.find((i) => i.isMain);
  if (main) return imageUrl(main);
  return imageUrl(images[0]);
}

/** All gallery images: main first, then non-minimal others */
export function getGalleryImages(medicine?: ApiMedicine): string[] {
  const images = medicine?.images ?? [];
  if (!images.length) return [];
  const main = images.find((i) => i.isMain);
  const others = images.filter((i) => !i.isMain && !i.isMinimal);
  const ordered = [main, ...others].filter(Boolean);
  return ordered.map((i) => imageUrl(i!)).filter(Boolean);
}

/** Cheapest price — uses minPrice from catalog API, falls back to offers, then medicine.price */
export function getCheapestPrice(medicine?: ApiMedicine): number | undefined {
  if (medicine?.minPrice && medicine.minPrice > 0) return medicine.minPrice;
  const prices = (medicine?.offers ?? []).map((o) => o.price).filter((p) => p > 0);
  if (prices.length === 0) return medicine?.price ?? undefined;
  return Math.min(...prices);
}

/** Legacy: first image (backwards compat) */
export function resolveMedicineImageUrl(medicine?: ApiMedicine): string {
  return getMinimalImageUrl(medicine);
}

export function getMedicineDisplayName(medicine: ApiMedicine): string {
  return medicine.title || medicine.name || "Без названия";
}

export async function getCatalogMedicinesPaginated(page = 1, pageSize = 24): Promise<ApiPaginated<ApiMedicine>> {
  return apiFetch<ApiPaginated<ApiMedicine>>(`/api/medicines?page=${page}&pageSize=${pageSize}`);
}

export async function searchMedicines(query: string, limit = 24): Promise<ApiMedicine[]> {
  const response = await apiFetch<{ medicines?: ApiMedicine[] }>("/api/medicines/search", {
    method: "POST",
    body: { query, limit }
  });
  return Array.isArray(response?.medicines) ? response.medicines : [];
}

