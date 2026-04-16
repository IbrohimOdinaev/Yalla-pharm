import { apiFetch } from "@/shared/api/http-client";

export type ActivePharmacy = {
  id: string;
  title: string;
  address: string;
  isActive?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
};

export async function getActivePharmacies(token?: string): Promise<ActivePharmacy[]> {
  const response = await apiFetch<{ pharmacies?: ActivePharmacy[] }>("/api/pharmacies", {
    ...(token ? { token } : {})
  });

  return Array.isArray(response?.pharmacies) ? response.pharmacies : [];
}
