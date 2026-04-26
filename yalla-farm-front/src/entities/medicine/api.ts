import { apiFetch } from "@/shared/api/http-client";
import { env } from "@/shared/config/env";
import type { ApiMedicine, ApiPaginated, ApiSearchByPharmacyResponse } from "@/shared/types/api";

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

/** Get image URL by image object. Pass `width` to request a server-resized
 *  WebP variant — the backend buckets to {120, 240, 480, 800}. Anything
 *  larger or no width returns the original. */
export function imageUrl(img?: { id?: string; url?: string }, width?: number): string {
  if (!img) return "";
  if (img.url) return img.url;
  if (img.id) {
    const base = `${env.apiBaseUrl}/api/medicines/images/${img.id}/content`;
    return width ? `${base}?w=${width}` : base;
  }
  return "";
}

/** Minimal image (for catalog grid thumbnails) */
export function getMinimalImageUrl(medicine?: ApiMedicine, width?: number): string {
  const images = medicine?.images ?? [];
  const minimal = images.find((i) => i.isMinimal);
  if (minimal) return imageUrl(minimal, width);
  const main = images.find((i) => i.isMain);
  if (main) return imageUrl(main, width);
  return imageUrl(images[0], width);
}

/** Main image (for product detail hero) */
export function getMainImageUrl(medicine?: ApiMedicine, width?: number): string {
  const images = medicine?.images ?? [];
  const main = images.find((i) => i.isMain);
  if (main) return imageUrl(main, width);
  return imageUrl(images[0], width);
}

/** All gallery images: main first, then non-minimal others */
export function getGalleryImages(medicine?: ApiMedicine, width?: number): string[] {
  const images = medicine?.images ?? [];
  if (!images.length) return [];
  const main = images.find((i) => i.isMain);
  const others = images.filter((i) => !i.isMain && !i.isMinimal);
  const ordered = [main, ...others].filter(Boolean);
  return ordered.map((i) => imageUrl(i!, width)).filter(Boolean);
}

/** Cheapest price — uses minPrice from catalog API, falls back to offers, then medicine.price */
export function getCheapestPrice(medicine?: ApiMedicine): number | undefined {
  if (medicine?.minPrice && medicine.minPrice > 0) return medicine.minPrice;
  const prices = (medicine?.offers ?? []).map((o) => o.price).filter((p) => p > 0);
  if (prices.length === 0) return medicine?.price ?? undefined;
  return Math.min(...prices);
}

/** Legacy: first image (backwards compat) */
export function resolveMedicineImageUrl(medicine?: ApiMedicine, width?: number): string {
  return getMinimalImageUrl(medicine, width);
}

export function getMedicineDisplayName(medicine: ApiMedicine): string {
  return medicine.title || medicine.name || "Без названия";
}

export async function getCatalogMedicinesPaginated(page = 1, pageSize = 24, categoryId?: string, pharmacyId?: string): Promise<ApiPaginated<ApiMedicine>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (categoryId) params.set("categoryId", categoryId);
  if (pharmacyId) params.set("pharmacyId", pharmacyId);
  return apiFetch<ApiPaginated<ApiMedicine>>(`/api/medicines?${params}`);
}

export async function searchMedicines(query: string, limit = 24): Promise<ApiMedicine[]> {
  const response = await apiFetch<{ medicines?: ApiMedicine[] }>("/api/medicines/search", {
    method: "POST",
    body: { query, limit }
  });
  return Array.isArray(response?.medicines) ? response.medicines : [];
}

export type LiveSearchSuggestion = {
  id: string;
  title: string;
  articul: string;
  categoryName?: string;
  minPrice?: number;
  score: number;
};

export async function liveSearch(query: string, limit = 10): Promise<LiveSearchSuggestion[]> {
  const response = await apiFetch<{ suggestions?: LiveSearchSuggestion[] }>(`/api/medicines/live-search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return Array.isArray(response?.suggestions) ? response.suggestions : [];
}

export async function searchByPharmacy(query: string, limit = 20): Promise<ApiSearchByPharmacyResponse> {
  const response = await apiFetch<ApiSearchByPharmacyResponse>("/api/medicines/search-by-pharmacy", {
    method: "POST",
    body: { query, limit }
  });
  return response ?? { query, totalCount: 0, pharmacies: [] };
}

