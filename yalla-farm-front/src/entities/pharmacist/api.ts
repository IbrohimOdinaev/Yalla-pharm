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
