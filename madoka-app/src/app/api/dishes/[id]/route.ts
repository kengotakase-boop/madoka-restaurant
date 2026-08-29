import { NextResponse } from "next/server";
import { apiError, missingConfigResponse, rpc, serializeDish, type RpcDish } from "@/app/api/_madokaSupabase";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

type UpdateBody = {
  name?: unknown;
  genre?: unknown;
  note?: unknown;
  isSpecial?: unknown;
  cookedAt?: unknown;
  imagePath?: unknown;
};

export async function GET(_request: Request, context: Context) {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const { id } = await context.params;
    const rows = await rpc<RpcDish[]>("madoka_restaurant_get_dish", {
      p_id: id,
    });
    return NextResponse.json(rows[0] ? serializeDish(rows[0]) : null);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateBody;
    if (typeof body.imagePath === "string" && body.name === undefined) {
      await rpc("madoka_restaurant_update_dish_image", {
        p_id: id,
        p_image_path: body.imagePath,
      });
      return NextResponse.json({ ok: true });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    await rpc("madoka_restaurant_update_dish", {
      p_id: id,
      p_name: name,
      p_genre: typeof body.genre === "string" ? body.genre : "other",
      p_note: typeof body.note === "string" ? body.note : "",
      p_is_special: Boolean(body.isSpecial),
      p_cooked_at:
        typeof body.cookedAt === "string" ? body.cookedAt : new Date().toISOString(),
      p_image_path: typeof body.imagePath === "string" ? body.imagePath : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const missing = missingConfigResponse();
  if (missing) return missing;
  try {
    const { id } = await context.params;
    await rpc("madoka_restaurant_delete_dish", { p_id: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
