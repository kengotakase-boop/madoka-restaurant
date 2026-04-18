// 家族として利用を許可する Google アカウントの email 一覧。
// ここに追加すれば即座にアクセス許可される（コード差分のみ、DB 変更なし）。
export const FAMILY_EMAILS: readonly string[] = [
  "kengotakase@gmail.com",
];

export function isFamilyMember(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return FAMILY_EMAILS.some((e) => e.toLowerCase() === normalized);
}
