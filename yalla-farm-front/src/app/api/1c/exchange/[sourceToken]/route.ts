import { NextRequest } from "next/server";
import { handleOneCGet, handleOneCPost } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    sourceToken: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { sourceToken } = await context.params;
  return handleOneCGet(request, sourceToken);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { sourceToken } = await context.params;
  return handleOneCPost(request, sourceToken);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return POST(request, context);
}
