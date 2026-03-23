import { env } from "@/shared/config/env";

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
};

function isJsonLikeBody(body: unknown): body is Record<string, unknown> | Array<unknown> {
  return typeof body === "object" && body !== null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = `${env.apiBaseUrl}${path}`;
  const headers = new Headers(options.headers ?? {});
  const token = options.token ?? null;

  if (isJsonLikeBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: isJsonLikeBody(options.body) ? JSON.stringify(options.body) : (options.body as BodyInit | null | undefined)
  });

  const raw = await response.text();
  const data = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const message = extractApiErrorMessage(data) ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractApiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as Record<string, unknown>;

  const messageParts: string[] = [];

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    messageParts.push(candidate.message.trim());
  }

  if (typeof candidate.title === "string" && candidate.title.trim()) {
    messageParts.push(candidate.title.trim());
  }

  if (typeof candidate.detail === "string" && candidate.detail.trim()) {
    messageParts.push(candidate.detail.trim());
  }

  const validationErrors = collectValidationErrors(candidate.errors);
  if (validationErrors.length > 0) {
    messageParts.push(validationErrors.join(" | "));
  }

  if (typeof candidate.reason === "string" && candidate.reason.trim()) {
    messageParts.push(`Reason: ${candidate.reason.trim()}`);
  }

  const uniqueMessageParts = [...new Set(messageParts.filter(Boolean))];
  return uniqueMessageParts.length > 0 ? uniqueMessageParts.join(". ") : null;
}

function collectValidationErrors(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  const entries = Object.entries(value as Record<string, unknown>);
  const errors: string[] = [];

  for (const [field, fieldErrors] of entries) {
    if (Array.isArray(fieldErrors)) {
      const normalized = fieldErrors
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);

      if (normalized.length > 0) {
        errors.push(`${field}: ${normalized.join(", ")}`);
      }
      continue;
    }

    if (typeof fieldErrors === "string" && fieldErrors.trim()) {
      errors.push(`${field}: ${fieldErrors.trim()}`);
    }
  }

  return errors;
}
