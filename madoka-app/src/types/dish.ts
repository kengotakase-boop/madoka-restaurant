import type { Timestamp } from "firebase/firestore";
import type { GenreId } from "@/constants/genre";

export type Dish = {
  id: string;
  name: string;
  genre: GenreId;
  note: string;
  isSpecial: boolean;
  isAiGenerated: boolean;
  aiOriginal: string | null;
  cookedAt: Timestamp;
  yearMonth: string;
  ownerUid: string;
  ownerName?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  imagePath: string;
  ingredients: string[];
  steps: string[];
};
