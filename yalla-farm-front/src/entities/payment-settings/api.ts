import { apiFetch } from "@/shared/api/http-client";

export type PaymentSettingsSnapshot = {
  dcBaseUrl: string | null;
  dcBaseUrlEffective: string;
  alifUrlTemplate: string | null;
  alifUrlTemplateEffective: string;
  eskhataUrlTemplate: string | null;
  eskhataUrlTemplateEffective: string;
  isDcEnabled: boolean;
  isAlifEnabled: boolean;
  isEskhataEnabled: boolean;
  pharmacyOrderReadyFeeAmount: number;
  prescriptionDecodedFeeAmount: number;
  updatedAtUtc: string;
  updatedByUserId: string | null;
};

export type PublicPaymentSettings = {
  dcBaseUrlEffective: string;
  alifUrlTemplateEffective: string;
  eskhataUrlTemplateEffective: string;
  isDcEnabled: boolean;
  isAlifEnabled: boolean;
  isEskhataEnabled: boolean;
};

export async function getPaymentSettings(token: string): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings", { token });
}

export async function getPublicPaymentSettings(): Promise<PublicPaymentSettings> {
  return apiFetch<PublicPaymentSettings>("/api/payment-settings/public");
}

export async function updateDcBaseUrl(token: string, url: string | null): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings/dc-base-url", {
    method: "PUT",
    token,
    body: { url },
  });
}

export async function updateAlifUrlTemplate(token: string, urlTemplate: string | null): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings/alif-url-template", {
    method: "PUT",
    token,
    body: { urlTemplate },
  });
}

export async function updateEskhataUrlTemplate(token: string, urlTemplate: string | null): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings/eskhata-url-template", {
    method: "PUT",
    token,
    body: { urlTemplate },
  });
}

export async function updatePaymentMethodEnabled(
  token: string,
  method: "dc" | "alif" | "eskhata",
  isEnabled: boolean,
): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>(`/api/payment-settings/method/${method}/enabled`, {
    method: "PUT",
    token,
    body: { isEnabled },
  });
}

export async function updateStaffCompensationRates(
  token: string,
  input: { pharmacyOrderReadyFeeAmount: number; prescriptionDecodedFeeAmount: number },
): Promise<PaymentSettingsSnapshot> {
  return apiFetch<PaymentSettingsSnapshot>("/api/payment-settings/staff-compensation-rates", {
    method: "PUT",
    token,
    body: input,
  });
}
