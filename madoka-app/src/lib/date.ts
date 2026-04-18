import type { Timestamp } from "firebase/firestore";

export function toYearMonthJst(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(date);
}

// Firestore Timestamp を `YYYY/MM/DD HH:mm`（JST）で返す。null/undefined は "" を返す。
export function formatDateTimeJst(
  ts: Timestamp | null | undefined,
): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts.toDate());
}
