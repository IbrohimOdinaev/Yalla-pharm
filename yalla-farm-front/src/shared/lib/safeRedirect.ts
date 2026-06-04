const LOCAL_ORIGIN = "https://yalla.local";

export function normalizeLocalRedirect(value: string | null | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const url = new URL(candidate, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
