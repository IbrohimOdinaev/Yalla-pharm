import { apiFetch } from "@/shared/api/http-client";
import type { ApiPrescription } from "./api";

/** SuperAdmin queue: prescriptions awaiting the 3 TJS sign-off. */
export async function getAwaitingConfirmation(token: string): Promise<ApiPrescription[]> {
  return apiFetch<ApiPrescription[]>("/api/prescriptions/superadmin/awaiting-confirmation", { token });
}

/** SuperAdmin marks payment as confirmed → prescription enters the pharmacist queue. */
export async function confirmPrescriptionPayment(
  token: string,
  prescriptionId: string,
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(
    `/api/prescriptions/superadmin/${prescriptionId}/confirm`,
    { method: "POST", token },
  );
}
