import { apiFetch } from "@/shared/api/http-client";

export type OneCExchangeStatus = {
  lastContactAtUtc?: string | null;
  lastMode?: string | null;
  lastCheckAuthAtUtc?: string | null;
  lastInitAtUtc?: string | null;
  lastFileAtUtc?: string | null;
  lastFilename?: string | null;
  lastFileSize?: number | null;
};

export type OneCSource = {
  id: string;
  pharmacyId: string;
  pharmacyTitle: string;
  token: string;
  name: string;
  isActive: boolean;
  endpointPath: string;
  createdAtUtc: string;
  exchangeStatus: OneCExchangeStatus;
};

export async function getOneCSources(token: string): Promise<OneCSource[]> {
  const response = await apiFetch<OneCSource[]>("/api/1c/sources", { token });
  return Array.isArray(response) ? response : [];
}

export async function createOneCSource(
  token: string,
  data: { pharmacyId: string; sourceToken: string; name: string }
): Promise<OneCSource> {
  return apiFetch<OneCSource>("/api/1c/sources", {
    method: "POST",
    token,
    body: {
      pharmacyId: data.pharmacyId,
      token: data.sourceToken,
      name: data.name,
    },
  });
}

export async function updateOneCSource(
  token: string,
  sourceId: string,
  data: { name: string; isActive: boolean }
): Promise<OneCSource> {
  return apiFetch<OneCSource>(`/api/1c/sources/${sourceId}`, {
    method: "PUT",
    token,
    body: data,
  });
}

export async function setOneCSourceActive(token: string, sourceId: string, isActive: boolean): Promise<OneCSource> {
  return apiFetch<OneCSource>(`/api/1c/sources/${sourceId}/${isActive ? "enable" : "disable"}`, {
    method: "POST",
    token,
  });
}

export async function deleteOneCSource(token: string, sourceId: string): Promise<void> {
  await apiFetch<unknown>(`/api/1c/sources/${sourceId}`, {
    method: "DELETE",
    token,
  });
}
