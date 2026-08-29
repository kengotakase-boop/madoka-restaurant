import type { GenreId } from "@/constants/genre";

export type TimestampLike = {
  toDate(): Date;
};

export type Dish = {
  id: string;
  name: string;
  genre: GenreId;
  note: string;
  isSpecial: boolean;
  isAiGenerated: boolean;
  aiOriginal: string | null;
  cookedAt: TimestampLike;
  yearMonth: string;
  createdAt: TimestampLike | null;
  updatedAt: TimestampLike | null;
  imagePath: string;
  ingredients: string[];
  steps: string[];
};
