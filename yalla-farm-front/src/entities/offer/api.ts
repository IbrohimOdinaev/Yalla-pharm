import { apiFetch } from "@/shared/api/http-client";

export async function upsertOffer(token: string, data: { medicineId: string; stockQuantity: number; price: number }): Promise<void> {
  await apiFetch<unknown>("/api/offers", { method: "POST", token, body: data });
}
