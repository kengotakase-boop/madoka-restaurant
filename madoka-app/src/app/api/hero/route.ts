import { NextResponse } from "next/server";
import { apiError, missingConfigResponse, rpc } from "@/app/api/_madokaSupabase";

export const runtime = "nodejs";

export async function GET() {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const image = await rpc<string | null>("madoka_restaurant_get_hero");
    return NextResponse.json({ image });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const body = (await request.json()) as { image?: unknown };
    await rpc("madoka_restaurant_set_hero", {
      p_value: typeof body.image === "string" && body.image ? body.image : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
