import { IMAGES_ENABLED } from "@/config/features";
import { DISH_ID_PATTERN, IMAGE_TYPES, imageSignatureMatches, parseDishImagePath } from "@/lib/imageRules";
import { rpc, type RpcDish } from "../../../_madokaSupabase";
import { ImageStorageError, fetchDishImage, imageErrorResponse, putDishImage, readImageBytes, requirePrivateImageBucket } from "../../../_dishImageStorage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function getDish(id: string) {
  if (!IMAGES_ENABLED) throw new ImageStorageError(503, "写真機能は停止中です。");
  if (!DISH_ID_PATTERN.test(id)) throw new ImageStorageError(400, "料理IDが不正です。");
  const rows = await rpc<RpcDish[]>("madoka_restaurant_get_dish", { p_id: id });
  if (!rows[0]) throw new ImageStorageError(404, "料理が見つかりません。");
  return rows[0];
}

export async function POST(request: Request, context: Context) {
  try {
    // CSRF mitigation, NOT user authentication. Keep the existing shared API trust model.
    if (request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("x-madoka-image-upload") !== "1") {
      throw new ImageStorageError(403, "この画面から写真を選び直してください。");
    }
    const { id } = await context.params;
    const type = request.headers.get("content-type") ?? "";
    if (!IMAGE_TYPES.some((allowed) => allowed === type)) throw new ImageStorageError(415, "JPEG・PNG・WebPのみ対応しています。");
    await getDish(id);
    await requirePrivateImageBucket();
    const bytes = await readImageBytes(request.body);
    if (!imageSignatureMatches(bytes, type)) throw new ImageStorageError(415, "画像の内容と形式が一致しません。");
    const imagePath = await putDishImage(id, bytes, type);
    try {
      await rpc("madoka_restaurant_update_dish_image", { p_id: id, p_image_path: imagePath });
      // A void-returning RPC must not silently succeed if a dish disappeared concurrently.
      const linked = await getDish(id);
      if (linked.image_path !== imagePath) throw new Error("image_not_linked");
    } catch {
      // A timeout may mean the RPC committed. Never delete a possibly linked object.
      // A retry overwrites the same dish-scoped key, so uncertain outcomes cannot
      // accumulate additional objects. Legacy objects are intentionally untouched.
      throw new ImageStorageError(502, "写真の紐付けを確認できませんでした。料理は残っています。詳細画面で確認してください。");
    }
    return Response.json({ imagePath }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return imageErrorResponse(error); }
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const dish = await getDish(id);
    const path = dish.image_path ?? "";
    const parsed = parseDishImagePath(path);
    if (!parsed || parsed.dishId.toLowerCase() !== id.toLowerCase()) {
      throw new ImageStorageError(404, "料理写真は未設定です。");
    }
    await requirePrivateImageBucket();
    const { bytes, type } = await fetchDishImage(path);
    if (!imageSignatureMatches(bytes, type)) throw new ImageStorageError(502, "写真を読み込めませんでした。");
    return new Response(new Blob([new Uint8Array(bytes)], { type }), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) { return imageErrorResponse(error); }
}
