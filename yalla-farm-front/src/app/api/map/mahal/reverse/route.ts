import { NextRequest, NextResponse } from "next/server";
import { requestMahal, type MahalAddressItem } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat")?.trim() ?? "";
  const lng = request.nextUrl.searchParams.get("lng")?.trim() ?? "";
  if (!lat || !lng) {
    return NextResponse.json({ message: "lat and lng are required" }, { status: 400 });
  }

  const response = await requestMahal("getAddressByLocation", { lat, lng });
  if (!response.ok) {
    return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
  }
  const payload = await response.json();
  const items = Array.isArray(payload) ? payload as MahalAddressItem[] : [];
  const item = items.find((x) => x.kind === "address") ?? items[0];
  if (!item) {
    return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
  }

  const address = item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
  return NextResponse.json(
    { address, lat: Number(lat), lng: Number(lng) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
