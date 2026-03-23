import { apiFetch } from "@/shared/api/http-client";
import type { ApiMedicine } from "@/shared/types/api";

export async function getAllMedicines(token: string, query = "", page = 1, pageSize = 50): Promise<ApiMedicine[]> {
  const q = query ? `&query=${encodeURIComponent(query)}` : "";
  const response = await apiFetch<{ medicines?: ApiMedicine[] }>(`/api/medicines/all?page=${page}&pageSize=${pageSize}${q}`, { token });
  return Array.isArray(response?.medicines) ? response.medicines : [];
}

export async function createMedicine(token: string, data: { title: string; articul: string; atributes?: Array<{ name: string; option: string }> }): Promise<void> {
  await apiFetch<unknown>("/api/medicines", { method: "POST", token, body: data });
}

export async function updateMedicine(token: string, data: { medicineId: string; title: string; articul: string }): Promise<void> {
  await apiFetch<unknown>("/api/medicines", { method: "PUT", token, body: data });
}

export async function deleteMedicine(token: string, medicineId: string, permanently = false): Promise<void> {
  await apiFetch<unknown>("/api/medicines", { method: "DELETE", token, body: { medicineId, permanently } });
}

export async function uploadMedicineImage(token: string, medicineId: string, file: File, isMain = false, isMinimal = false): Promise<void> {
  const formData = new FormData();
  formData.append("medicineId", medicineId);
  formData.append("isMain", String(isMain));
  formData.append("isMinimal", String(isMinimal));
  formData.append("image", file);

  const { env } = await import("@/shared/config/env");
  const response = await fetch(`${env.apiBaseUrl}/api/medicines/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  if (!response.ok) throw new Error("Не удалось загрузить изображение.");
}
