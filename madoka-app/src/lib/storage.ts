import { IMAGES_ENABLED } from "@/config/features";
import { DISH_ID_PATTERN, imageFileError, MAX_IMAGE_UPLOAD_BYTES, parseDishImagePath } from "./imageRules";

async function prepareImage(file: File): Promise<Blob> {
  const error = imageFileError(file);
  if (error) throw new Error(error);
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("写真の縮小処理が利用できません。");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Re-encoding also removes EXIF/GPS; never upload the original camera file.
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.86));
      if (blob && blob.size > 0 && blob.size <= MAX_IMAGE_UPLOAD_BYTES) return blob;
      scale *= 0.75;
    }
    throw new Error("写真を4MB以下に縮小できませんでした。小さい写真を選び直してください。");
  } finally { bitmap.close(); }
}

export async function uploadDishImage(file: File, dishId: string): Promise<string> {
  if (!IMAGES_ENABLED) throw new Error("写真機能は停止中です。");
  if (!DISH_ID_PATTERN.test(dishId)) throw new Error("料理IDが不正です。");
  const body = await prepareImage(file);
  const response = await fetch(`/api/dishes/${dishId}/image`, {
    method: "POST",
    headers: { "Content-Type": body.type, "X-Madoka-Image-Upload": "1" },
    body,
    signal: AbortSignal.timeout(90_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "写真のアップロードに失敗しました。");
  if (typeof result.imagePath !== "string" || !parseDishImagePath(result.imagePath)) throw new Error("写真の保存結果を確認できませんでした。");
  return result.imagePath;
}

export function getDishImageUrl(imagePath: string): string | null {
  const parsed = parseDishImagePath(imagePath);
  if (!parsed) return null;
  return `/api/dishes/${parsed.dishId}/image?v=${parsed.imageId}`;
}
