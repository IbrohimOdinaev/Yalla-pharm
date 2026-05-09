import { apiFetch } from "@/shared/api/http-client";
import type {
  ApiManualLookupHistory,
  ApiManualLookupRequest,
  ApiManualLookupResponse,
} from "./api";

export async function getActiveManualLookups(
  token: string,
): Promise<ApiManualLookupRequest[]> {
  return apiFetch<ApiManualLookupRequest[]>("/api/manual-lookups/admin/active", { token });
}

export async function getManualLookupHistory(
  token: string,
  page = 1,
  pageSize = 50,
): Promise<ApiManualLookupHistory> {
  return apiFetch<ApiManualLookupHistory>(
    `/api/manual-lookups/admin/history?page=${page}&pageSize=${pageSize}`,
    { token },
  );
}

export async function getMyManualLookupResponse(
  token: string,
  requestId: string,
): Promise<ApiManualLookupResponse | null> {
  try {
    return await apiFetch<ApiManualLookupResponse>(
      `/api/manual-lookups/admin/${requestId}/my-response`,
      { token },
    );
  } catch (err) {
    // 404 = no prior response from this pharmacy yet — return null so
    // callers can render "create" mode without distinguishing failures.
    if (err instanceof Error && /not found/i.test(err.message)) return null;
    throw err;
  }
}

/**
 * Multipart upsert. `photo` is optional; passing `clearImage=true` with no
 * new photo removes the previously-uploaded one.
 */
export async function respondToManualLookup(
  token: string,
  requestId: string,
  input: {
    fullName: string;
    price: number;
    quantity: number;
    responseComment?: string | null;
    photo?: File | null;
    clearImage?: boolean;
  },
): Promise<ApiManualLookupResponse> {
  const form = new FormData();
  form.append("FullName", input.fullName);
  form.append("Price", String(input.price));
  form.append("Quantity", String(input.quantity));
  if (input.responseComment) form.append("ResponseComment", input.responseComment);
  if (input.clearImage) form.append("ClearImage", "true");
  if (input.photo) form.append("photo", input.photo);

  return apiFetch<ApiManualLookupResponse>(
    `/api/manual-lookups/admin/${requestId}/respond`,
    { method: "POST", token, body: form },
  );
}
