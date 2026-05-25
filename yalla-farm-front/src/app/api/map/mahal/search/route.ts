import { NextRequest, NextResponse } from "next/server";
import { requestMahal } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUSHANBE_CENTER = { lat: 38.5598, lng: 68.7738 } as const;

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim() ?? "";
  if (text.length < 2) {
    return NextResponse.json([]);
  }

  return requestMahal("getAddress", {
    text,
    lat: request.nextUrl.searchParams.get("lat") ?? String(DUSHANBE_CENTER.lat),
    lng: request.nextUrl.searchParams.get("lng") ?? String(DUSHANBE_CENTER.lng),
    limit: request.nextUrl.searchParams.get("limit") ?? "8",
  });
}
