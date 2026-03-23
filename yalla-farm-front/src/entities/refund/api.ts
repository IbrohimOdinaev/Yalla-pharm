import { apiFetch } from "@/shared/api/http-client";
import type { ApiRefundRequest } from "@/shared/types/api";

export async function getRefundRequests(token: string, page = 1, pageSize = 20): Promise<ApiRefundRequest[]> {
  const response = await apiFetch<{ refundRequests?: ApiRefundRequest[] }>(`/api/refund-requests?page=${page}&pageSize=${pageSize}`, { token });
  return Array.isArray(response?.refundRequests) ? response.refundRequests : [];
}

export async function initiateRefund(token: string, refundRequestId: string): Promise<void> {
  await apiFetch<unknown>("/api/refund-requests/initiate", { method: "POST", token, body: { refundRequestId } });
}
