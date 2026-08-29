import { NextResponse } from "next/server";
import { apiError, missingConfigResponse, rpc, serializeDish, type RpcDish } from "@/app/api/_madokaSupabase";

export const runtime = "nodejs";

type CreateBody = {
  name?: unknown;
  genre?: unknown;
  note?: unknown;
  isSpecial?: unknown;
  isAiGenerated?: unknown;
  aiOriginal?: unknown;
  cookedAt?: unknown;
  yearMonth?: unknown;
  imagePath?: unknown;
  ingredients?: unknown;
  steps?: unknown;
};

export async function GET() {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const rows = await rpc<RpcDish[]>("madoka_restaurant_list_dishes");
    return NextResponse.json(rows.map(serializeDish));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const body = (await request.json()) as CreateBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const cookedAt =
      typeof body.cookedAt === "string" ? body.cookedAt : new Date().toISOString();
    const id = await rpc<string>("madoka_restaurant_create_dish", {
      p_name: name,
      p_genre: typeof body.genre === "string" ? body.genre : "other",
      p_note: typeof body.note === "string" ? body.note : "",
      p_is_special: Boolean(body.isSpecial),
      p_is_ai_generated: Boolean(body.isAiGenerated),
      p_ai_original: typeof body.aiOriginal === "string" ? body.aiOriginal : null,
      p_cooked_at: cookedAt,
      p_year_month:
        typeof body.yearMonth === "string" ? body.yearMonth : cookedAt.slice(0, 7),
      p_image_path: typeof body.imagePath === "string" ? body.imagePath : "",
      p_ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      p_steps: Array.isArray(body.steps) ? body.steps : [],
    });
    return NextResponse.json({ id });
  } catch (error) {
    return apiError(error);
  }
}
