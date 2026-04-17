export const GENRE_IDS = [
  "washoku",
  "yoshoku",
  "italian",
  "chinese",
  "korean",
  "ethnic",
  "sweets",
  "bread",
  "other",
] as const;

export type GenreId = (typeof GENRE_IDS)[number];

export const GENRE_LABELS: Record<GenreId, string> = {
  washoku: "和食",
  yoshoku: "洋食",
  italian: "イタリアン",
  chinese: "中華",
  korean: "韓国料理",
  ethnic: "エスニック",
  sweets: "スイーツ",
  bread: "パン",
  other: "その他",
};

export function isGenreId(v: unknown): v is GenreId {
  return typeof v === "string" && (GENRE_IDS as readonly string[]).includes(v);
}

export function toGenreId(v: unknown): GenreId {
  return isGenreId(v) ? v : "other";
}

export function genreLabel(v: unknown): string {
  return GENRE_LABELS[toGenreId(v)];
}
