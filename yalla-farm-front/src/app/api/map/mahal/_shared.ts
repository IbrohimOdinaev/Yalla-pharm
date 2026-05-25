import { NextResponse } from "next/server";

const MAHAL_BASE_URL = "https://platform.mahal.tj/api/services";
const FALLBACK_TEST_TOKEN = "b831b2ab-8498-4d17-8e4b-7f396a6e1f54";

type AnyRecord = Record<string, unknown>;

export type MahalAddressItem = {
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  kind?: string;
};

function getToken() {
  return (
    process.env.MAHAL_API_TOKEN
    ?? process.env.NEXT_PUBLIC_MAHAL_API_TOKEN
    ?? FALLBACK_TEST_TOKEN
  );
}

function stringField(source: unknown, key: string) {
  if (!source || typeof source !== "object") return "";
  const value = (source as AnyRecord)[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberField(source: unknown, key: string) {
  if (!source || typeof source !== "object") return null;
  const value = (source as AnyRecord)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function detailInfo(item: unknown) {
  const value = item && typeof item === "object" ? (item as AnyRecord).detailInfo : null;
  return value && !Array.isArray(value) && typeof value === "object" ? value : null;
}

function detailAddress(item: unknown) {
  const value = item && typeof item === "object" ? (item as AnyRecord).detailAddress : null;
  return value && !Array.isArray(value) && typeof value === "object" ? value : null;
}

function compactUnique(parts: string[]) {
  const seen = new Set<string>();
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildStreet(address: unknown) {
  const street = compactUnique([
    [stringField(address, "street_type"), stringField(address, "street_name")].filter(Boolean).join(" "),
    stringField(address, "number"),
  ]);
  return street.join(", ");
}

function buildArea(address: unknown) {
  return compactUnique([
    stringField(address, "subject_name"),
    stringField(address, "settlement"),
    stringField(address, "district"),
    stringField(address, "region"),
  ]).join(", ");
}

function formatMahalItem(item: unknown): MahalAddressItem | null {
  const lat = numberField(item, "latitude");
  const lng = numberField(item, "longitude");
  if (lat == null || lng == null) return null;

  const info = detailInfo(item);
  const address = detailAddress(item);
  const type = stringField(item, "type").toLowerCase();
  const name = stringField(info, "name") || stringField(info, "translate_ru");
  const category = stringField(info, "categories");
  const street = buildStreet(address);
  const area = buildArea(address);
  const fallbackTitle =
    stringField(item, "address")
    || stringField(item, "title")
    || stringField(item, "display_name")
    || stringField(item, "name");

  const isAddress = type === "address";
  const title = (isAddress ? street || name : name || street) || fallbackTitle || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const subtitle = compactUnique([
    isAddress ? area : street,
    isAddress ? "" : area,
    category,
  ]).join(", ");

  return { title, subtitle: subtitle || undefined, lat, lng, kind: type || undefined };
}

export async function requestMahal(path: "getAddress" | "getAddressByLocation", params: Record<string, string>) {
  const url = new URL(`${MAHAL_BASE_URL}/${path}`);
  url.searchParams.set("token", getToken());
  for (const [key, value] of Object.entries(params)) {
    if (value.trim()) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return NextResponse.json(
      { message: `Mahal request failed: ${response.status}` },
      { status: 502 },
    );
  }

  const json = await response.json() as AnyRecord;
  const rawData = json.data;
  const items = (Array.isArray(rawData) ? rawData : rawData ? [rawData] : [])
    .map(formatMahalItem)
    .filter((item): item is MahalAddressItem => item != null);

  return NextResponse.json(items, {
    headers: { "Cache-Control": "no-store" },
  });
}
