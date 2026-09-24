import "server-only";
import { randomUUID } from "node:crypto";
import { DISH_ID_PATTERN, IMAGE_TYPES, MAX_IMAGE_UPLOAD_BYTES, parseDishImagePath } from "@/lib/imageRules";
import { missingConfigResponse } from "./_madokaSupabase";

export const DISH_IMAGE_BUCKET = "madoka-restaurant-images";

export class ImageStorageError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function config() {
  const url = process.env.TAKASE_APPS_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Deliberately no NEXT_PUBLIC key and no fallback to unrelated service-role keys.
  const key = process.env.MADOKA_RESTAURANT_STORAGE_SERVICE_ROLE_KEY;
  if (!url || !key || missingConfigResponse()) {
    throw new ImageStorageError(503, "写真保存は未設定です。料理データは保存できます。");
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function storageFetch(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  try {
    return await fetch(`${url}/storage/v1/${path}`, {
      ...init,
      headers: { ...init.headers, apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ImageStorageError(503, "写真保存先に接続できません。しばらくしてから再試行してください。");
  }
}

export async function requirePrivateImageBucket() {
  const response = await storageFetch(`bucket/${DISH_IMAGE_BUCKET}`);
  if (!response.ok) throw new ImageStorageError(503, "写真保存先は未設定、または利用できません。");
  const bucket = await response.json();
  if (bucket.id !== DISH_IMAGE_BUCKET || bucket.public !== false) {
    throw new ImageStorageError(503, "専用private bucketの設定を確認してください。");
  }
}

export async function putDishImage(dishId: string, bytes: Uint8Array, type: string): Promise<string> {
  if (!DISH_ID_PATTERN.test(dishId)) throw new ImageStorageError(400, "料理IDが不正です。");
  // Derive the only writable key here, not from request fields or the existing DB path.
  // Normalize UUID case so retries cannot create an additional object by changing case.
  const path = `${dishId.toLowerCase()}/main`;
  const response = await storageFetch(`object/${DISH_IMAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: { "Content-Type": type, "x-upsert": "true", "Cache-Control": "max-age=0" },
    body: new Blob([new Uint8Array(bytes)], { type }),
  });
  if (!response.ok) throw new ImageStorageError(502, "写真のアップロードに失敗しました。");
  return path;
}

// Content-Length can be absent or forged, so enforce a bound while reading.
export async function readImageBytes(stream: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
  if (!stream) throw new ImageStorageError(400, "写真がありません。");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_IMAGE_UPLOAD_BYTES) {
        await reader.cancel();
        throw new ImageStorageError(413, "送信する写真は縮小後4MB以下にしてください。");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new ImageStorageError(400, "写真がありません。");
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function fetchDishImage(path: string) {
  if (!parseDishImagePath(path)) throw new ImageStorageError(400, "料理写真のパスが不正です。");
  // Upserts keep the object key stable. CDN invalidation can lag even with
  // no-cache headers, so bypass stale reads without changing the saved path.
  const response = await storageFetch(`object/authenticated/${DISH_IMAGE_BUCKET}/${path}?cacheNonce=${randomUUID()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new ImageStorageError(response.status === 404 ? 404 : 502, "写真を読み込めませんでした。");
  const type = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!IMAGE_TYPES.some((allowed) => allowed === type)) {
    await response.body?.cancel();
    throw new ImageStorageError(502, "対応していない画像形式です。");
  }
  return { bytes: await readImageBytes(response.body), type };
}

export function imageErrorResponse(error: unknown) {
  // Never expose upstream responses, URLs, credentials, or database errors.
  return Response.json({ error: error instanceof ImageStorageError ? error.message : "写真の処理に失敗しました。" }, {
    status: error instanceof ImageStorageError ? error.status : 502,
    headers: { "Cache-Control": "private, no-store" },
  });
}
