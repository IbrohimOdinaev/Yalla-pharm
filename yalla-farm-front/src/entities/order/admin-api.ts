import { apiFetch } from "@/shared/api/http-client";
import type { ApiOrder } from "@/shared/types/api";
import { normalizeOrder } from "./api";

export type OrdersPageResult = {
  orders: ApiOrder[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type OrdersQuery = {
  status?: string;
  page?: number;
  pageSize?: number;
  date?: string;
};

const DUSHANBE_OFFSET_MS = 5 * 60 * 60 * 1000;

function appendDateRange(params: URLSearchParams, date?: string) {
  if (!date) return;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return;
  const startUtcMs = Date.UTC(year, month - 1, day) - DUSHANBE_OFFSET_MS;
  const endUtcMs = Date.UTC(year, month - 1, day + 1) - DUSHANBE_OFFSET_MS;
  params.set("fromUtc", new Date(startUtcMs).toISOString());
  params.set("toUtc", new Date(endUtcMs).toISOString());
}

function buildOrdersQuery({ status = "", page = 1, pageSize = 50, date = "" }: OrdersQuery) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status) params.set("status", status);
  appendDateRange(params, date);
  return params.toString();
}

function normalizeOrdersPage(response: { orders?: Record<string, unknown>[]; page?: number; pageSize?: number; totalCount?: number }): OrdersPageResult {
  return {
    orders: Array.isArray(response?.orders) ? response.orders.map(o => normalizeOrder(o)) : [],
    page: Number(response?.page || 1),
    pageSize: Number(response?.pageSize || 0),
    totalCount: Number(response?.totalCount || 0),
  };
}

export async function getAdminOrdersPage(token: string, options: OrdersQuery = {}): Promise<OrdersPageResult> {
  const response = await apiFetch<{ orders?: Record<string, unknown>[]; page?: number; pageSize?: number; totalCount?: number }>(
    `/api/orders/admin/history?${buildOrdersQuery({ pageSize: 120, ...options })}`,
    { token }
  );
  return normalizeOrdersPage(response);
}

export async function getAdminOrders(token: string, status = "", page = 1, pageSize = 120, date = ""): Promise<ApiOrder[]> {
  return (await getAdminOrdersPage(token, { status, page, pageSize, date })).orders;
}

export async function getAllOrdersPage(token: string, options: OrdersQuery = {}): Promise<OrdersPageResult> {
  const response = await apiFetch<{ orders?: Record<string, unknown>[]; page?: number; pageSize?: number; totalCount?: number }>(
    `/api/orders/all?${buildOrdersQuery({ pageSize: 50, ...options })}`,
    { token }
  );
  return normalizeOrdersPage(response);
}

export async function getAllOrders(token: string, status = "", page = 1, pageSize = 20, date = ""): Promise<ApiOrder[]> {
  return (await getAllOrdersPage(token, { status, page, pageSize, date })).orders;
}

export async function startAssembly(token: string, orderId: string, acceptedByAdminId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/assembly/start", {
    method: "POST",
    token,
    body: { orderId, acceptedByAdminId },
  });
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

export async function superAdminCancelOrder(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/cancel-by-super-admin", { method: "POST", token, body: { orderId } });
}

export async function adminCancelOrder(token: string, orderId: string): Promise<void> {
  await apiFetch<unknown>("/api/orders/cancel-by-admin", { method: "POST", token, body: { orderId } });
}

export async function superAdminReturnPositions(
  token: string,
  orderId: string,
  positions: { positionId: string; quantity: number }[]
): Promise<void> {
  await apiFetch<unknown>("/api/orders/return-by-super-admin", {
    method: "POST",
    token,
    body: { orderId, positions },
  });
}
