import { apiFetch } from "./http-client";

export type AddressSuggestion = {
  id: number;
  title: string;
  address: string;
  type: string;
  lat: number;
  lng: number;
};

export async function searchAddress(text: string): Promise<AddressSuggestion[]> {
  return apiFetch<AddressSuggestion[]>(`/api/address/search?text=${encodeURIComponent(text)}`);
}
