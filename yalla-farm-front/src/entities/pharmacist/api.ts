import { apiFetch } from "@/shared/api/http-client";

export type ApiPharmacist = {
  id: string;
  name: string;
  phoneNumber: string;
};

export async function getPharmacists(token: string): Promise<ApiPharmacist[]> {
  return apiFetch<ApiPharmacist[]>("/api/pharmacists", { token });
}

export async function registerPharmacist(
  token: string,
  input: { name: string; phoneNumber: string; password: string },
): Promise<{ pharmacistId: string }> {
  return apiFetch<{ pharmacistId: string }>("/api/pharmacists/register", {
    method: "POST",
    token,
    body: input,
  });
}

export async function deletePharmacist(token: string, pharmacistId: string): Promise<void> {
  await apiFetch<unknown>(`/api/pharmacists/${pharmacistId}`, { method: "DELETE", token });
}

/* ── Pharmacist workspace API (for the pharmacist's own UI, not SuperAdmin) ── */

import type { ApiPrescription } from "@/entities/prescription/api";

export async function getPharmacistQueue(token: string): Promise<ApiPrescription[]> {
  return apiFetch<ApiPrescription[]>("/api/prescriptions/pharmacist/queue", { token });
}

/** InQueue + my InReview + my Decoded — fuels the active-prescription picker. */
export async function getPharmacistAll(token: string): Promise<ApiPrescription[]> {
  return apiFetch<ApiPrescription[]>("/api/prescriptions/pharmacist/all", { token });
}

export async function getPharmacistPrescription(
  token: string,
  prescriptionId: string,
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(`/api/prescriptions/pharmacist/${prescriptionId}`, { token });
}

export async function takePrescriptionIntoReview(
  token: string,
  prescriptionId: string,
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(
    `/api/prescriptions/pharmacist/${prescriptionId}/take`,
    { method: "POST", token },
  );
}

export type DecodePrescriptionItemInput = {
  medicineId?: string | null;
  manualMedicineName?: string | null;
  quantity: number;
  pharmacistComment?: string | null;
  /** 0 = Original (default), 1 = Undecoded. */
  kind?: number;
  /** Index of the analog item in the same `items` array (0-based). When
   *  set, this item is the "original" of a pair and the referenced
   *  sibling becomes the analog. Server resolves indices to GUIDs after
   *  creating the rows. Self-reference / cycles / out-of-bounds rejected. */
  analogIndex?: number | null;
  /** When set, the server preserves the lookup binding for this manual
   *  line and closes the request once the checklist is submitted. */
  lookupRequestId?: string | null;
  /** Pharmacist switched the row into "by units" pricing. Required:
   *  `unitCount` ≥ 1 and `unitTotalPrice` > 0. Server stores it on the
   *  checklist item and propagates to OrderPosition at checkout. */
  useUnitMode?: boolean;
  unitCount?: number | null;
  unitTotalPrice?: number | null;
};

export async function submitChecklist(
  token: string,
  prescriptionId: string,
  input: { overallComment: string | null; items: DecodePrescriptionItemInput[] },
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(
    `/api/prescriptions/pharmacist/${prescriptionId}/decode`,
    { method: "POST", token, body: input },
  );
}

/** Pharmacist's "I can't decode this" exit. Reason is required —
 *  PoorImageQuality grants the client a free credit, IllegibleHandwriting
 *  creates a PendingRefund row for SuperAdmin. */
export async function markPrescriptionDecodeFailed(
  token: string,
  prescriptionId: string,
  reason: "PoorImageQuality" | "IllegibleHandwriting",
  comment?: string | null,
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(
    `/api/prescriptions/pharmacist/${prescriptionId}/decode-failed`,
    { method: "POST", token, body: { reason, comment: comment ?? null } },
  );
}
