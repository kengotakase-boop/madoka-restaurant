import { NextResponse } from "next/server";

const supabaseUrl =
  process.env.TAKASE_APPS_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiSecret = process.env.MADOKA_RESTAURANT_API_SECRET;

export function missingConfigResponse() {
  if (supabaseUrl && supabaseKey && apiSecret) return null;
  return NextResponse.json(
    { error: "Madoka Restaurant backend is not configured" },
    { status: 500 },
  );
}

type RpcError = {
  message?: string;
  code?: string;
};

export async function rpc<T>(
  fn: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const missing = missingConfigResponse();
  if (missing) throw new Error("missing_config");

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey!,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: apiSecret, ...params }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as RpcError;
    throw new Error(body.message ?? body.code ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiError(error: unknown) {
  console.error("[madoka api]", error);
  const message = error instanceof Error ? error.message : "unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export type RpcDish = {
  id: string;
  name: string;
  genre: string;
  note: string | null;
  is_special: boolean;
  is_ai_generated: boolean;
  ai_original: string | null;
  cooked_at: string;
  year_month: string;
  image_path: string | null;
  ingredients: unknown;
  steps: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export function serializeDish(row: RpcDish) {
  return {
    id: row.id,
    name: row.name,
    genre: row.genre,
    note: row.note,
    isSpecial: row.is_special,
    isAiGenerated: row.is_ai_generated,
    aiOriginal: row.ai_original,
    cookedAt: row.cooked_at,
    yearMonth: row.year_month,
    imagePath: row.image_path,
    ingredients: row.ingredients,
    steps: row.steps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
