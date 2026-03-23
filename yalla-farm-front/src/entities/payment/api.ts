import { apiFetch } from "@/shared/api/http-client";

export type ApiPaymentIntent = {
  paymentIntentId: string;
  clientId?: string;
  clientPhone?: string;
  reservedOrderId?: string;
  amount?: number;
  currency?: string;
  state?: number;
  createdAtUtc?: string;
};

export async function getPendingPaymentIntents(token: string, page = 1, pageSize = 50): Promise<ApiPaymentIntent[]> {
  const response = await apiFetch<{ paymentIntents?: ApiPaymentIntent[] }>(
    `/api/superadmin/payment-intents?states=AwaitingAdminConfirmation&states=NeedsResolution&page=${page}&pageSize=${pageSize}`,
    { token }
  );
  return Array.isArray(response?.paymentIntents) ? response.paymentIntents : [];
}

export async function confirmPaymentIntent(token: string, paymentIntentId: string): Promise<void> {
  await apiFetch<unknown>(`/api/superadmin/payment-intents/${paymentIntentId}/confirm`, {
    method: "POST",
    token,
    body: { paymentIntentId }
  });
}

export async function rejectPaymentIntent(token: string, paymentIntentId: string): Promise<void> {
  await apiFetch<unknown>(`/api/superadmin/payment-intents/${paymentIntentId}/reject`, {
    method: "POST",
    token,
    body: { paymentIntentId }
  });
}
