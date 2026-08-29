import { toYearMonthJst } from "@/lib/date";
import { toGenreId, type GenreId } from "@/constants/genre";
import type { Dish, TimestampLike } from "@/types/dish";

type ApiDish = {
  id: string;
  name: string;
  genre: unknown;
  note: string | null;
  isSpecial: boolean;
  isAiGenerated: boolean;
  aiOriginal: string | null;
  cookedAt: string;
  yearMonth: string;
  createdAt: string | null;
  updatedAt: string | null;
  imagePath: string | null;
  ingredients: unknown;
  steps: unknown;
};

function timestamp(value: string | null): TimestampLike | null {
  if (!value) return null;
  return { toDate: () => new Date(value) };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalize(raw: ApiDish): Dish {
  return {
    id: raw.id,
    name: raw.name,
    genre: toGenreId(raw.genre),
    note: raw.note ?? "",
    isSpecial: raw.isSpecial,
    isAiGenerated: raw.isAiGenerated,
    aiOriginal: raw.aiOriginal,
    cookedAt: timestamp(raw.cookedAt) ?? timestamp(new Date().toISOString())!,
    yearMonth: raw.yearMonth,
    createdAt: timestamp(raw.createdAt),
    updatedAt: timestamp(raw.updatedAt),
    imagePath: raw.imagePath ?? "",
    ingredients: stringList(raw.ingredients),
    steps: stringList(raw.steps),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(String(err.error ?? res.statusText));
  }
  return (await res.json()) as T;
}

export type CreateDishInput = {
  name: string;
  genre: GenreId;
  note: string;
  isSpecial: boolean;
  cookedAt: Date;
  ingredients?: string[];
  steps?: string[];
  isAiGenerated?: boolean;
  aiOriginal?: string | null;
};

export async function createDish(input: CreateDishInput): Promise<string> {
  const created = await request<{ id: string }>("/api/dishes", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      cookedAt: input.cookedAt.toISOString(),
      yearMonth: toYearMonthJst(input.cookedAt),
    }),
  });
  return created.id;
}

export async function getAllDishes(): Promise<Dish[]> {
  const list = await request<ApiDish[]>("/api/dishes", { cache: "no-store" });
  return list.map(normalize);
}

export async function getDishById(id: string): Promise<Dish | null> {
  const dish = await request<ApiDish | null>(`/api/dishes/${id}`, {
    cache: "no-store",
  });
  return dish ? normalize(dish) : null;
}

export type UpdateDishInput = {
  name: string;
  genre: GenreId;
  note: string;
  isSpecial: boolean;
  cookedAt: Date;
};

export async function updateDish(
  id: string,
  input: UpdateDishInput,
): Promise<void> {
  await request(`/api/dishes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      cookedAt: input.cookedAt.toISOString(),
    }),
  });
}

export async function updateDishImagePath(
  id: string,
  imagePath: string,
): Promise<void> {
  await request(`/api/dishes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ imagePath }),
  });
}

export async function deleteDish(id: string): Promise<void> {
  await request(`/api/dishes/${id}`, { method: "DELETE" });
}
