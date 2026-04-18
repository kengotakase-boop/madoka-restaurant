import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toYearMonthJst } from "@/lib/date";
import { toGenreId, type GenreId } from "@/constants/genre";
import type { Dish } from "@/types/dish";

const dishesCol = () => collection(db, "dishes");

type DishRaw = Omit<Dish, "id" | "genre"> & { genre: unknown };

function normalize(id: string, raw: DishRaw): Dish {
  return {
    ...raw,
    id,
    genre: toGenreId(raw.genre),
  };
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
  const cookedAt = Timestamp.fromDate(input.cookedAt);
  const yearMonth = toYearMonthJst(input.cookedAt);
  const ref = await addDoc(dishesCol(), {
    name: input.name,
    genre: input.genre,
    note: input.note,
    isSpecial: input.isSpecial,
    isAiGenerated: input.isAiGenerated ?? false,
    aiOriginal: input.aiOriginal ?? null,
    cookedAt,
    yearMonth,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    imagePath: "",
    ingredients: input.ingredients ?? [],
    steps: input.steps ?? [],
  });
  return ref.id;
}

export async function getAllDishes(): Promise<Dish[]> {
  const snap = await getDocs(dishesCol());
  const list = snap.docs.map((d) => normalize(d.id, d.data() as DishRaw));
  return list.sort((a, b) => {
    const aMs = a.cookedAt?.toMillis?.() ?? 0;
    const bMs = b.cookedAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

export async function getDishById(id: string): Promise<Dish | null> {
  const ref = doc(db, "dishes", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalize(snap.id, snap.data() as DishRaw);
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
  const ref = doc(db, "dishes", id);
  const cookedAt = Timestamp.fromDate(input.cookedAt);
  const yearMonth = toYearMonthJst(input.cookedAt);
  await updateDoc(ref, {
    name: input.name,
    genre: input.genre,
    note: input.note,
    isSpecial: input.isSpecial,
    cookedAt,
    yearMonth,
    updatedAt: serverTimestamp(),
  });
}

export async function updateDishImagePath(
  id: string,
  imagePath: string,
): Promise<void> {
  const ref = doc(db, "dishes", id);
  await updateDoc(ref, {
    imagePath,
    updatedAt: serverTimestamp(),
  });
}
