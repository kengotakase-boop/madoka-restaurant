import type { TimestampLike } from "@/types/dish";

export function formatDateJst(ts: TimestampLike | null | undefined): string {
  const date = ts?.toDate();
  if (!date || !Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replaceAll("/", ".");
}

export function toYearMonthJst(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(date);
}

export function formatDateTimeJst(
  ts: TimestampLike | null | undefined,
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
