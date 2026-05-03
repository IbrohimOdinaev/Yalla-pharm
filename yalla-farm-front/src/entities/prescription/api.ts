import { apiFetch } from "@/shared/api/http-client";
import { env } from "@/shared/config/env";

export type PrescriptionStatus =
  | "Submitted"
  | "AwaitingConfirmation"
  | "InQueue"
  | "InReview"
  | "Decoded"
  | "OrderPlaced"
  | "MovedToCart"
  | "Cancelled";

export type ApiPrescriptionImage = {
  id: string;
  orderIndex: number;
  url: string;
};

export type ApiPrescriptionChecklistItem = {
  id: string;
  medicineId?: string | null;
  manualMedicineName?: string | null;
  quantity: number;
  pharmacistComment?: string | null;
};

export type ApiPrescription = {
  prescriptionId: string;
  status: PrescriptionStatus;
  patientAge: number;
  clientComment?: string | null;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
  decodedAtUtc?: string | null;
  pharmacistOverallComment?: string | null;
  assignedPharmacistId?: string | null;
  orderId?: string | null;
  paymentIntentId?: string | null;
  images: ApiPrescriptionImage[];
  items: ApiPrescriptionChecklistItem[];
};

/**
 * Resolves the relative `images[i].url` returned by the backend (e.g.
 * `/api/prescriptions/images/{id}/content`) to a full URL using the
 * configured `apiBaseUrl`.
 */
export function resolvePrescriptionImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${env.apiBaseUrl}${url}`;
}

export async function getMyPrescriptions(token: string): Promise<ApiPrescription[]> {
  return apiFetch<ApiPrescription[]>("/api/prescriptions/me", { token });
}

export async function createPrescription(
  token: string,
  input: { patientAge: number; clientComment: string | null; photos: File[] }
): Promise<ApiPrescription> {
  if (!input.photos.length) throw new Error("Добавьте хотя бы одно фото рецепта.");
  if (input.photos.length > 2) throw new Error("Можно загрузить не более 2 фото на один рецепт.");

  const form = new FormData();
  form.append("PatientAge", String(input.patientAge));
  if (input.clientComment) form.append("ClientComment", input.clientComment);
  for (const photo of input.photos) form.append("photos", photo);

  return apiFetch<ApiPrescription>("/api/prescriptions", {
    method: "POST",
    body: form,
    token
  });
}

export const PRESCRIPTION_STATUS_LABEL_RU: Record<PrescriptionStatus, string> = {
  Submitted: "Отправлен",
  AwaitingConfirmation: "Ждёт подтверждения",
  InQueue: "В очереди",
  InReview: "Расшифровывается",
  Decoded: "Готов чек-лист",
  OrderPlaced: "Заказ оформлен",
  MovedToCart: "В корзине",
  Cancelled: "Отменён"
};
