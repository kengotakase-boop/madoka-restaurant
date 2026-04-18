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
| `/` | 一覧トップ。hero ＋ CTA ＋ **検索入力** ＋ 「最近の記録」リスト（各カードに更新日時表示） | `src/app/page.tsx` |
| `/new` | 新規登録フォーム。料理名／ジャンル／メモ／調理日時／特別料理。AI レシピ下書き生成ボタン付き | `src/app/new/page.tsx` |
| `/dish/[id]` | 詳細表示。料理名・ジャンル・調理日時・yearMonth・**更新日時**・メモ・材料・手順・AIバッジ。編集リンク常時表示 | `src/app/dish/[id]/page.tsx` |
| `/dish/[id]/edit` | 編集フォーム。料理名・ジャンル・メモ・調理日時・特別料理を更新 | `src/app/dish/[id]/edit/page.tsx` |

4 画面いずれも AuthGuard なし。ログイン状態に関係なく開く。

---

## 現在の機能（実装済み）

- **一覧**: 家族全員分の dishes を `updatedAt ?? createdAt` 降順で表示。件数と小さな更新日時付き
- **登録**: `/new` からフォーム 1 発。`createdAt`/`updatedAt` に同時刻を記録、`cookedAt` 未入力時は現在時刻を採用
- **詳細**: 登録／編集後に自動遷移。ジャンル・調理日時・yearMonth・更新日時・メモ・材料・手順・AI バッジを表示
- **編集**: `/dish/[id]/edit` で上書き保存。成功すると `updatedAt` が更新され、保存後に詳細へ戻る
- **更新順表示**: 最近触った dish ほど一覧上位。`updatedAt` が null の旧 doc は `createdAt` へフォールバック
- **更新日時表示**: 一覧カード末尾の小さい 1 行 `更新 YYYY/MM/DD HH:mm`、詳細の `<dl>` に `更新日時` 行
- **検索**: 一覧上部の 1 本の input。料理名・メモ・ジャンル（表示ラベル）を対象に部分一致・大小無視。0 件時は「該当する記録がありません」、空欄で全件に戻る。並び順は維持

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

## あえて未対応にした項目

| 項目 | 状態 | 理由 |
|---|---|---|
| **delete** | Rules で `false` 固定 / UI ゼロ | 誤って家族の記録を消すリスクを避ける。本当に消したい時が来たら慎重に設計する |
| **バックアップ** | なし | 今は件数が少ない。件数が増えるまで判断を遅らせる |
| **画像機能** | `IMAGES_ENABLED = false` で遮断 | Storage が Blaze プラン必須のため。有料化の意思決定を先送り中 |
| **認証復活** | やらない方向で確定 | アカウント設計なし・URL 共有ベースを維持。迷った時はこの方針に戻る |

---

## 完了判定

**このアプリは現時点で完了扱いにしてよい。**

家族共通の料理記録帳として実用可能な最小スコープを満たしている。以下の 3 点が揃っており、日常運用で致命的に不足する機能は無い:

- CRUD（C/R/U）が全員分の台帳に通る
- 最近触った dish が上に出る（+ 更新日時が目で確認できる）
- 料理名・メモで目的の dish を引ける

以降は「使ってみて違和感が出た時に触る」運用でよい。次候補はこのページ下部を参照。

---

## 次候補（追加実装するならこの順で 3 つ）

実データで動かしてみて必要度が高まったタイミングで、上から順に検討する:

1. **モバイル最適化** — 家族が主に触るのはスマホ前提。現在の hero 文字サイズ(48-52px)・一覧カード余白・検索入力の押しやすさを実機で見直す。ここの体感が日常満足度に最も効く
2. **バックアップ（定期 export）** — Rules 全開 + URL 共有 ベースなので、データ誤消去や Firestore 側事故の保険として JSON export の定期運用を仕込む。スクリプト 1 本で充分
3. **Delete 機能** — 誤投稿を消したくなる場面が実運用で必ず来る。Rules の `allow delete` 条件緩和 + 確認ダイアログ付き UI。慎重設計前提

それ以外の候補（相対日付表示、ジャンル絞り込みタブ、ダークモード、AI 生成の精度改善、Blaze 化での画像復活 等）はこの 3 つを超えない優先度。

**やらない方向性として決めているもの:**
- 認証ありへの逆戻り（アカウント設計なしを維持）
- 投稿者の表示（owner 概念は捨てた）

---

## 参考

- 一覧取得は `getAllDishes()` 一本（`src/lib/dishes.ts`）
- AI レシピ生成は `/api/generate` を経由（実装は `src/app/api/generate/route.ts`）
- ジャンル定義は `src/constants/genre.ts`
