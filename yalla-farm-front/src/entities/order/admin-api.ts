import { apiFetch } from "@/shared/api/http-client";
import type { ApiOrder } from "@/shared/types/api";

export async function getAdminOrders(token: string, status = "", page = 1, pageSize = 120): Promise<ApiOrder[]> {
  const s = status ? `&status=${encodeURIComponent(status)}` : "";
  const response = await apiFetch<{ orders?: ApiOrder[] }>(`/api/orders/admin/history?page=${page}&pageSize=${pageSize}${s}`, { token });
  return Array.isArray(response?.orders) ? response.orders : [];
}

export async function getAllOrders(token: string, status = "", page = 1, pageSize = 20): Promise<ApiOrder[]> {
  const s = status ? `&status=${encodeURIComponent(status)}` : "";
  const response = await apiFetch<{ orders?: ApiOrder[] }>(`/api/orders/all?page=${page}&pageSize=${pageSize}${s}`, { token });
  return Array.isArray(response?.orders) ? response.orders : [];
}

export async function startAssembly(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/assembly/start", { method: "POST", token, body: { orderId } });
}

export async function markReady(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/ready", { method: "POST", token, body: { orderId } });
}

export async function markOnTheWay(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/on-the-way", { method: "POST", token, body: { orderId } });
}

export async function deleteNewOrder(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>(`/api/orders/admin/new/delete`, { method: "POST", token, body: { orderId } });
}

export async function superAdminNextStatus(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/superadmin/next-status", { method: "POST", token, body: { orderId } });
}

export async function rejectPositions(token: string, orderId: string, positionIds: string[]): Promise<void> {
  await apiFetch<unknown>("/api/orders/positions/reject", { method: "POST", token, body: { orderId, positionIds } });
}
