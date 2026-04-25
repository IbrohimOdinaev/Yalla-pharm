import { apiFetch } from "@/shared/api/http-client";
import type { ApiBasket, ApiBasketPharmacyOption } from "@/shared/types/api";

export async function getBasket(token: string): Promise<ApiBasket> {
  const response = await apiFetch<{
    basketPositions?: Array<{
      positionId: string;
      medicineId: string;
      quantity: number;
    }>;
    pharmacyOptions?: ApiBasket["pharmacyOptions"];
  }>("/api/basket", { token });

  return {
    positions: Array.isArray(response?.basketPositions)
      ? response.basketPositions.map((item) => ({
        id: item.positionId,
        medicineId: item.medicineId,
        quantity: item.quantity
      }))
      : [],
    pharmacyOptions: Array.isArray(response?.pharmacyOptions) ? response.pharmacyOptions : []
  };
}

export async function addToBasket(token: string, medicineId: string, quantity = 1): Promise<ApiBasket> {
  await apiFetch<unknown>("/api/basket/items", {
    method: "POST",
    token,
    body: {
      medicineId,
      quantity
    }
  });
  return getBasket(token);
}

export async function removeFromBasket(token: string, positionId: string): Promise<ApiBasket> {
  await apiFetch<unknown>("/api/basket/items", {
    method: "DELETE",
    token,
    body: {
      positionId
    }
  });
  return getBasket(token);
}

export async function updateBasketQuantity(token: string, positionId: string, quantity: number): Promise<ApiBasket> {
  await apiFetch<unknown>("/api/basket/items/quantity", {
    method: "PATCH",
    token,
    body: {
      positionId,
      quantity
    }
  });
  return getBasket(token);
}

export async function clearBasket(token: string): Promise<ApiBasket> {
  await apiFetch<unknown>("/api/basket", {
    method: "DELETE",
    token,
    body: {}
  });
  return getBasket(token);
}

/**
 * Anonymous per-pharmacy breakdown for the guest cart. The same best-price logic
 * the authenticated top-bar uses works on the returned `pharmacyOptions`, so the
 * guest pill can show "от X TJS" identically.
 */
export async function getGuestBasketPreview(
  positions: Array<{ medicineId: string; quantity: number }>,
): Promise<ApiBasketPharmacyOption[]> {
  if (positions.length === 0) return [];
  const response = await apiFetch<{ pharmacyOptions?: ApiBasketPharmacyOption[] }>(
    "/api/basket/guest-preview",
    { method: "POST", body: { positions } },
  );
  return Array.isArray(response?.pharmacyOptions) ? response.pharmacyOptions : [];
}
