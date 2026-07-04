import { DORU_DUSHANBE_ACTIVE_PHARMACIES } from "@/entities/pharmacy/doru-dushanbe-integrated";
import type { ApiCategory, ApiMedicine, ApiPaginated } from "@/shared/types/api";

type ApiPharmacy = {
  id: string;
  title?: string;
  address?: string;
  isActive?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  hasDelivery?: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
};

export type SeoMedicineRoute = {
  path: string;
};

export type SeoCategoryRoute = {
  path: string;
};

export type SeoPharmacyItem = {
  id: string;
  title: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  hasDelivery?: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
};

function getServerApiBaseUrl() {
  const value = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return value.replace(/\/+$/, "");
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const apiBaseUrl = getServerApiBaseUrl();
  if (!apiBaseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function flattenCategories(categories: ApiCategory[]): ApiCategory[] {
  const result: ApiCategory[] = [];

  for (const category of categories) {
    result.push(category);
    if (category.children?.length) result.push(...flattenCategories(category.children));
  }

  return result;
}

function normalizeMedicineRoute(medicine: ApiMedicine): SeoMedicineRoute | null {
  if (medicine.isActive === false) return null;

  const idOrSlug = medicine.slug?.trim() || medicine.id;
  if (!idOrSlug) return null;

  return { path: `/product/${encodeURIComponent(idOrSlug)}` };
}

export async function fetchSeoMedicineRoutes(maxPages = 5, pageSize = 100): Promise<SeoMedicineRoute[]> {
  const routes: SeoMedicineRoute[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchJson<ApiPaginated<ApiMedicine>>(
      `/api/medicines?page=${page}&pageSize=${pageSize}`,
    );
    const medicines = Array.isArray(response?.medicines) ? response.medicines : [];
    if (medicines.length === 0) break;

    for (const medicine of medicines) {
      const route = normalizeMedicineRoute(medicine);
      if (route) routes.push(route);
    }

    const totalCount = response?.totalCount ?? 0;
    if (totalCount > 0 && page * pageSize >= totalCount) break;
  }

  return routes;
}

export async function fetchSeoCategoryRoutes(): Promise<SeoCategoryRoute[]> {
  const response = await fetchJson<{ categories?: ApiCategory[] }>("/api/categories");
  const categories = Array.isArray(response?.categories) ? flattenCategories(response.categories) : [];

  return categories
    .filter((category) => category.isActive !== false && category.slug?.trim())
    .map((category) => ({ path: `/catalog/${encodeURIComponent(category.slug.trim())}` }));
}

export async function fetchSeoPharmacies(limit = 80): Promise<SeoPharmacyItem[]> {
  const response = await fetchJson<{ pharmacies?: ApiPharmacy[] }>("/api/pharmacies");
  const apiPharmacies = Array.isArray(response?.pharmacies) ? response.pharmacies : [];
  const source = apiPharmacies.length > 0
    ? apiPharmacies
    : DORU_DUSHANBE_ACTIVE_PHARMACIES.map((pharmacy) => ({
        id: String(pharmacy.id),
        title: pharmacy.title,
        address: pharmacy.address,
        isActive: true,
        latitude: pharmacy.lat,
        longitude: pharmacy.lng,
        hasDelivery: Number(pharmacy.delivery ?? 0) > 0,
        opensAt: pharmacy.opensAt ?? null,
        closesAt: pharmacy.closesAt ?? null,
      }));

  return source
    .filter((pharmacy) => pharmacy.isActive !== false && pharmacy.title?.trim() && pharmacy.address?.trim())
    .slice(0, limit)
    .map((pharmacy) => ({
      id: pharmacy.id,
      title: pharmacy.title!.trim(),
      address: pharmacy.address!.trim(),
      latitude: pharmacy.latitude ?? null,
      longitude: pharmacy.longitude ?? null,
      hasDelivery: pharmacy.hasDelivery,
      opensAt: pharmacy.opensAt,
      closesAt: pharmacy.closesAt,
    }));
}
