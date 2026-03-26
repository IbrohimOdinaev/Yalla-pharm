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
  paymentUrl?: string;
};

// Raw shape from backend (field is "id", not "paymentIntentId"; "clientPhoneNumber" not "clientPhone")
type RawPaymentIntent = {
  id?: string;
  paymentIntentId?: string;
  clientId?: string;
  clientPhoneNumber?: string;
  clientPhone?: string;
  reservedOrderId?: string;
  amount?: number;
  currency?: string;
  state?: number;
  createdAtUtc?: string;
  paymentUrl?: string;
};

function normalizeIntent(raw: RawPaymentIntent): ApiPaymentIntent {
  return {
    paymentIntentId: raw.id || raw.paymentIntentId || "",
    clientId: raw.clientId,
    clientPhone: raw.clientPhoneNumber || raw.clientPhone,
    reservedOrderId: raw.reservedOrderId,
    amount: raw.amount,
    currency: raw.currency,
    state: raw.state,
    createdAtUtc: raw.createdAtUtc,
    paymentUrl: raw.paymentUrl,
  };
}

export async function getPendingPaymentIntents(token: string, page = 1, pageSize = 50): Promise<ApiPaymentIntent[]> {
  const response = await apiFetch<{ paymentIntents?: RawPaymentIntent[] }>(
    `/api/superadmin/payment-intents?states=AwaitingAdminConfirmation&states=NeedsResolution&page=${page}&pageSize=${pageSize}`,
    { token }
  );
  return Array.isArray(response?.paymentIntents) ? response.paymentIntents.map(normalizeIntent) : [];
}

export async function confirmPaymentIntent(token: string, paymentIntentId: string): Promise<void> {
  await apiFetch<unknown>(`/api/superadmin/payment-intents/${paymentIntentId}/confirm`, {
    method: "POST",
    token,
  });
}

export async function rejectPaymentIntent(token: string, paymentIntentId: string, reason = ""): Promise<void> {
  await apiFetch<unknown>(`/api/superadmin/payment-intents/${paymentIntentId}/reject`, {
    method: "POST",
    token,
    body: { reason },
  });
}
