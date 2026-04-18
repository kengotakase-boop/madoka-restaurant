// 家族として利用を許可する Google アカウントの email 一覧。
// ここに追加すれば UI 側の入口制御が許可される。
//
// ⚠ Firestore Rules 側にも同じリストがあります。追加する時は両方を更新してください:
//   madoka-app/firestore.rules（または Firebase Console → Firestore → ルール）
//   のトップにある isFamily() 関数内の email 配列
export const FAMILY_EMAILS: readonly string[] = [
  "kengotakase@gmail.com",
];

export function isFamilyMember(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return FAMILY_EMAILS.some((e) => e.toLowerCase() === normalized);
}
