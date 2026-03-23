import { apiFetch } from "@/shared/api/http-client";
import type { ApiOrder } from "@/shared/types/api";

export async function getClientOrderHistory(token: string): Promise<ApiOrder[]> {
  const response = await apiFetch<{ orders?: ApiOrder[] }>("/api/orders/client-history", { token });
  return Array.isArray(response?.orders) ? response.orders : [];
}

export async function getOrderById(token: string, orderId: string): Promise<ApiOrder> {
  const response = await apiFetch<ApiOrder>(`/api/orders/${orderId}`, { token });
  if (!response) throw new Error("Заказ не найден.");
  return response;
}

export async function cancelOrder(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/cancel", { method: "POST", token, body: { orderId } });
}
