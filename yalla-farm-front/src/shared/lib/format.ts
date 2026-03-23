export function formatMoney(value: number | null | undefined, currency = "TJS"): string {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safe.toFixed(2)} ${currency}`;
}

export function formatPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length <= 9) return `+992${digits}`;
  if (digits.startsWith("992")) return `+${digits}`;
  return `+${digits}`;
}
