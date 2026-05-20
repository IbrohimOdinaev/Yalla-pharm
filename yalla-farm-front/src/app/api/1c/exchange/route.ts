import { NextRequest } from "next/server";
import { handleOneCGet, handleOneCPost } from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleOneCGet(request);
}

export async function POST(request: NextRequest) {
  return handleOneCPost(request);
}

export async function PUT(request: NextRequest) {
  return POST(request);
}
