# madoka Restaurant — 現行仕様メモ

このドキュメントは **現在稼働している実装** を固定して記述する。
認証あり運用の痕跡を見て迷ったときは、ここに戻って確認する。

---

## 目的

家族のための共通料理記録帳。起動してすぐ使える・ログイン不要・アカウント概念なしで、
家族の誰でも同じ台帳に書ける／読める、を優先する。

legacy hero のキャプション "OUR FAMILY COOKBOOK" がそのままこのアプリの性格を表している。

---

## ログイン方針

**完全にログイン不要。** Google OAuth も family allowlist もない。
URL を知っている人（＝家族）が直接アクセスして使う。

`https://madoka-restaurant.vercel.app/` を開けば即 4 画面が使える。

---

## 4 画面の役割

| ルート | 役割 | 実装ファイル |
|---|---|---|
| `/` | 一覧トップ。hero ＋ 「＋今日の一皿を記録する」CTA ＋ 「最近の記録」リスト | `src/app/page.tsx` |
| `/new` | 新規登録フォーム。料理名／ジャンル／メモ／調理日時／特別料理。AI レシピ下書き生成ボタン付き | `src/app/new/page.tsx` |
| `/dish/[id]` | 詳細表示。料理名・ジャンル・調理日時・yearMonth・メモ・材料・手順・AIバッジ。編集リンク常時表示 | `src/app/dish/[id]/page.tsx` |
| `/dish/[id]/edit` | 編集フォーム。料理名・ジャンル・メモ・調理日時・特別料理を更新 | `src/app/dish/[id]/edit/page.tsx` |

4 画面いずれも AuthGuard なし。ログイン状態に関係なく開く。

---

## Firestore Rules（現在公開中のもの）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dishes/{dishId} {
      allow read, create, update: if true;
      allow delete: if false;
    }
  }
}
```

- read / create / update: **誰でも可**。認証を要求しない
- delete: **全員不可**。意図しないデータ消失を防ぐため、UI 上も削除導線は存在しない
- コレクションは `dishes` のみ
- リポジトリ上のミラー: `madoka-app/firestore.rules`

**セキュリティモデル:** obscurity ベース。プロジェクトの Firebase Config は公開バンドルに含まれるため、URL さえ知っていれば技術的には書き込み可能。家族のみが URL を知っている前提で成立している。将来家族外に漏れた場合は Firestore Rules を再度絞るか、アプリ自体を閉じる判断が必要。

---

## owner 概念の廃止

以前は `ownerUid` / `ownerName` を doc に書き込み、自分の記録だけ見える個別サイロ運用をしていたが、共通台帳方針に切り替えた時点で:

- `Dish` 型から `ownerUid` / `ownerName` を削除
- `CreateDishInput` から同フィールドを削除
- `createDish` での書き込みを停止
- 一覧・詳細・編集のどこにも記録者名を出さない
- 既存ドキュメントに残る `ownerUid` / `ownerName` フィールドは migration せず放置（新コードは参照しないので無害）

誰が記録したかは**意図的に表現しない**。家族全員が等しく台帳を持つ設計。

---

## 物理削除済みの認証機能

過去に実装して完全撤去したもの:

- `src/app/login/page.tsx`（Google サインイン画面）
- `src/components/AuthGuard.tsx`（認証＋family allowlist ガード）
- `src/hooks/useAuth.ts`（Firebase Auth 状態フック）
- `src/config/family.ts`（`FAMILY_EMAILS` / `isFamilyMember`）
- `src/lib/firebase.ts` から `auth` と `googleProvider` の export、および `getAuth` / `GoogleAuthProvider` import

残置しているのは `db`（Firestore）と `storage`（Firebase Storage、画像機能復活時用）のみ。

Firebase Console 側の Authentication 有効化・Google Provider・Authorized domain 設定は **削除せず残置** している。将来もし認証方式へ戻す場合にゼロから再有効化せずに済むための保険。

---

## 画像機能について

Storage は Spark プランでは有効化できないため休止中。`src/config/features.ts` の `IMAGES_ENABLED = false` で UI と upload 経路の両方を遮断。Blaze プラン化 + Storage 有効化 + Storage Rules 反映ができれば `IMAGES_ENABLED = true` に戻すだけで復活する。

---

## 今後やる場合の候補

実装順の優先度は未判断。やりたくなった時に検討する程度のメモ:

- **並び順の選択肢**: 現状 `cookedAt` 降順固定。「追加順」「ジャンル別」「★だけ」等のタブ or フィルタ
- **検索**: 料理名の部分一致、メモのキーワード検索
- **`updatedAt` 表示**: 編集済み doc の最終更新日時を詳細画面に出す
- **相対日付**: 一覧の日付を「今日／昨日／◯日前」に
- **Blaze 化 + 画像機能復活**: `IMAGES_ENABLED = true` + Storage ルール反映の運用手順
- **Delete 機能**: 誤投稿を消したくなった時。Rules の `allow delete` を開く判断と UI 追加
- **モバイル最適化**: hero 文字サイズの responsive、一覧カードの余白調整
- **バックアップ**: 台帳が増えた時に定期 export する仕組み

**やらない方向性として決めているもの:**
- 認証ありへの逆戻り（アカウント設計なしを維持）
- 投稿者の表示（owner 概念は捨てた）

---

## 参考

- 一覧取得は `getAllDishes()` 一本（`src/lib/dishes.ts`）
- AI レシピ生成は `/api/generate` を経由（実装は `src/app/api/generate/route.ts`）
- ジャンル定義は `src/constants/genre.ts`
