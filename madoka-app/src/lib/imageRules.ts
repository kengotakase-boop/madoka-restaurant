// Shared validation only: no server configuration or credentials in this module.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const MAX_IMAGE_SOURCE_BYTES = 10 * 1024 * 1024;
// Keep uploads and proxied responses below the hosting platform's 4.5 MB limit.
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;
export const DISH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAIN_IMAGE_PATH_PATTERN = /^([0-9a-f-]{36})\/main$/;
const LEGACY_IMAGE_PATH_PATTERN = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i;

export function imageFileError(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.some((type) => type === file.type)) return "JPEG・PNG・WebPを選択してください。";
  if (file.size === 0 || file.size > MAX_IMAGE_SOURCE_BYTES) return "写真は空でない10MB以下のファイルを選択してください。";
  return null;
}

export function parseDishImagePath(path: string) {
  const main = MAIN_IMAGE_PATH_PATTERN.exec(path);
  if (main && DISH_ID_PATTERN.test(main[1])) {
    return { dishId: main[1], imageId: "main", extension: null };
  }
  // Read compatibility only. New uploads never create another random UUID path.
  const match = LEGACY_IMAGE_PATH_PATTERN.exec(path);
  if (!match || !DISH_ID_PATTERN.test(match[1]) || !DISH_ID_PATTERN.test(match[2])) return null;
  return { dishId: match[1], imageId: match[2], extension: match[3].toLowerCase() };
}

export function imageSignatureMatches(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (type === "image/webp") return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}
