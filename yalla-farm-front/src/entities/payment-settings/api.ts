import { apiFetch } from "@/shared/api/http-client";

export type PaymentSettingsSnapshot = {
  dcBaseUrl: string | null;
  dcBaseUrlEffective: string;
  updatedAtUtc: string;
  updatedByUserId: string | null;
};

export async function getPaymentSettings(token: string): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings", { token });
}

export async function updateDcBaseUrl(token: string, url: string | null): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings/dc-base-url", {
    method: "PUT",
    token,
    body: { url },
  });
}
