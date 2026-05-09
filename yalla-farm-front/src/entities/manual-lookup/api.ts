import { apiFetch } from "@/shared/api/http-client";
import { env } from "@/shared/config/env";

export type ManualLookupRequestStatus = "Open" | "Closed";

export type ApiManualLookupResponse = {
  id: string;
  requestId: string;
  respondingPharmacyId: string;
  respondingPharmacyTitle?: string | null;
  respondingAdminId: string;
  fullName: string;
  price: number;
  quantity: number;
  /** Server returns a relative URL like `/api/manual-lookups/responses/{id}/image`
   *  when the admin attached a photo, otherwise null. */
  imageUrl?: string | null;
  responseComment?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type ApiManualLookupRequest = {
  id: string;
  prescriptionId: string;
  checklistItemId: string;
  requestedByPharmacistId: string;
  requestedByPharmacistName?: string | null;
  manualMedicineName: string;
  requestComment?: string | null;
  status: ManualLookupRequestStatus;
  createdAtUtc: string;
  closedAtUtc?: string | null;
  responses: ApiManualLookupResponse[];
};

export type ApiManualLookupHistory = {
  page: number;
  pageSize: number;
  totalCount: number;
  requests: ApiManualLookupRequest[];
};

/** Resolves a relative image URL to absolute using the API base URL. */
export function resolveManualLookupImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${env.apiBaseUrl}${url}`;
}

// ── Pharmacist ────────────────────────────────────────────────────────

export async function createManualLookupRequest(
  token: string,
  input: {
    prescriptionId: string;
    checklistItemId: string;
    manualMedicineName: string;
    requestComment?: string | null;
  },
): Promise<ApiManualLookupRequest> {
  return apiFetch<ApiManualLookupRequest>("/api/manual-lookups", {
    method: "POST",
    token,
    body: input,
  });
}

export async function getManualLookupsByPrescription(
  token: string,
  prescriptionId: string,
): Promise<ApiManualLookupRequest[]> {
  return apiFetch<ApiManualLookupRequest[]>(
    `/api/manual-lookups/by-prescription/${prescriptionId}`,
    { token },
  );
}

export async function getManualLookupById(
  token: string,
  requestId: string,
): Promise<ApiManualLookupRequest> {
  return apiFetch<ApiManualLookupRequest>(`/api/manual-lookups/${requestId}`, { token });
}
