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
  /** "Original" — pharmacist identified the medicine; "Undecoded" — couldn't read. */
  kind?: "Original" | "Undecoded";
  /** [Deprecated] Catalog-pick analog from the v1 flow. Kept on the
   *  payload for back-compat but always null in the new pair-from-cart
   *  flow — use {@link analogItemId} instead. */
  analogMedicineId?: string | null;
  /** Paired-analog: id of another item in the same checklist that the
   *  pharmacist selected as substitute for this position. Set on the
   *  "original" of the pair; the referenced sibling stays in `items`
   *  under its own row, and the renderer groups them into a block. */
  analogItemId?: string | null;
  /** FK to a ManualItemLookupRequest the pharmacist already created for
   *  this manual line (asked other pharmacies). Null for catalog items
   *  and for manual items without a lookup. */
  lookupRequestId?: string | null;
};

export type PrescriptionPreferenceTier = "AsPrescribed" | "GoldenMiddle" | "MaxSavings";

export const PRESCRIPTION_TIER_LABEL_RU: Record<PrescriptionPreferenceTier, string> = {
  AsPrescribed: "Как в рецепте",
  GoldenMiddle: "Золотая середина",
  MaxSavings: "Максимальная экономия",
};

export const PRESCRIPTION_TIER_DESCRIPTION_RU: Record<PrescriptionPreferenceTier, string> = {
  AsPrescribed: "Только то, что выписал врач — без замен.",
  GoldenMiddle: "Баланс между оригиналом и доступным аналогом.",
  MaxSavings: "Самые дешёвые из доступных аналогов для каждой позиции.",
};

/** Numeric value the backend expects in the create-prescription payload. */
export const PRESCRIPTION_TIER_VALUE: Record<PrescriptionPreferenceTier, number> = {
  AsPrescribed: 0,
  GoldenMiddle: 1,
  MaxSavings: 2,
};

export type ApiPrescription = {
  prescriptionId: string;
  clientId?: string;
  clientName?: string | null;
  clientPhoneNumber?: string | null;
  clientTelegramId?: number | null;
  clientTelegramUsername?: string | null;
  status: PrescriptionStatus;
  preferenceTier?: PrescriptionPreferenceTier;
  patientAge: number;
  clientComment?: string | null;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
  decodedAtUtc?: string | null;
  pharmacistOverallComment?: string | null;
  assignedPharmacistId?: string | null;
  orderId?: string | null;
  paymentIntentId?: string | null;
  /** One-shot DushanbeCity payment URL — only filled by createPrescription. */
  paymentUrl?: string | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
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

export async function markPrescriptionPaid(
  token: string,
  prescriptionId: string,
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(`/api/prescriptions/${prescriptionId}/i-paid`, {
    method: "POST",
    token,
  });
}

export type MoveChecklistToCartResponse = {
  prescription: ApiPrescription;
  movedItemsCount: number;
  skippedItemsCount: number;
};

export async function moveChecklistToCart(
  token: string,
  prescriptionId: string,
  options?: {
    /** Per-item quantity overrides the client edited on the prescription detail
     *  page. Map of `PrescriptionChecklistItem.id` → quantity. Items not in the
     *  map keep the pharmacist-recommended count; value 0 = removed. */
    quantityOverrides?: Record<string, number>;
    /** Per-pair selection. Key = original item id (the one with `analogItemId`
     *  set), value = chosen item id (either the original itself or its analog).
     *  Default when absent: the analog. */
    pairSelections?: Record<string, string>;
  },
): Promise<MoveChecklistToCartResponse> {
  const body: Record<string, unknown> = {};
  if (options?.quantityOverrides && Object.keys(options.quantityOverrides).length > 0) {
    body.quantityOverrides = options.quantityOverrides;
  }
  if (options?.pairSelections && Object.keys(options.pairSelections).length > 0) {
    body.pairSelections = options.pairSelections;
  }
  return apiFetch<MoveChecklistToCartResponse>(
    `/api/prescriptions/${prescriptionId}/move-to-cart`,
    { method: "POST", token, body },
  );
}

/**
 * Clones a Cancelled prescription as a fresh Submitted one with the same
 * photos / age / comment, returning a new payment URL. The previous record
 * stays in history; the new one needs payment within 24h or it'll be
 * auto-cancelled by the backend timeout job.
 */
export async function resubmitPrescription(
  token: string,
  prescriptionId: string,
): Promise<ApiPrescription> {
  return apiFetch<ApiPrescription>(
    `/api/prescriptions/${prescriptionId}/resubmit`,
    { method: "POST", token },
  );
}

export type ApiPrescriptionPharmacyItem = {
  checklistItemId: string;
  medicineId?: string | null;
  requestedQuantity: number;
  title: string;
  isFound: boolean;
  foundQuantity: number;
  hasEnoughQuantity: boolean;
  price?: number | null;
  isManualLookup: boolean;
};

export type ApiPrescriptionPharmacyOption = {
  pharmacyId: string;
  pharmacyTitle: string;
  pharmacyIsActive: boolean;
  foundItemsCount: number;
  totalItemsCount: number;
  enoughQuantityItemsCount: number;
  isAvailable: boolean;
  totalCost: number;
  items: ApiPrescriptionPharmacyItem[];
};

export type ApiPrescriptionPharmacyOptions = {
  prescriptionId: string;
  pharmacyOptions: ApiPrescriptionPharmacyOption[];
};

export async function getPrescriptionPharmacyOptions(
  token: string,
  prescriptionId: string,
): Promise<ApiPrescriptionPharmacyOptions> {
  return apiFetch<ApiPrescriptionPharmacyOptions>(
    `/api/prescriptions/${prescriptionId}/pharmacy-options`,
    { token },
  );
}

export async function createPrescription(
  token: string,
  input: {
    patientAge: number;
    clientComment: string | null;
    photos: File[];
    preferenceTier: PrescriptionPreferenceTier;
  }
): Promise<ApiPrescription> {
  if (!input.photos.length) throw new Error("Добавьте хотя бы одно фото рецепта.");
  if (input.photos.length > 2) throw new Error("Можно загрузить не более 2 фото на один рецепт.");

  const form = new FormData();
  form.append("PatientAge", String(input.patientAge));
  form.append("PreferenceTier", String(PRESCRIPTION_TIER_VALUE[input.preferenceTier]));
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
