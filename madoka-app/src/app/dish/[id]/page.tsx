"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import DishImage from "@/components/DishImage";
import { useAuth } from "@/hooks/useAuth";
import { getDishById } from "@/lib/dishes";
import { genreLabel } from "@/constants/genre";
import type { Dish } from "@/types/dish";

function formatDateTime(ts: Dish["cookedAt"] | null): string {
  if (!ts) return "";
  const d = ts.toDate();
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function Content({ id }: { id: string }) {
  const { user } = useAuth();
  const [dish, setDish] = useState<Dish | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const d = await getDishById(id);
        if (mounted) setDish(d);
      } catch (e) {
        console.error(e);
        if (mounted) setError("読み込みに失敗しました");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, user]);

  if (error) {
    return <main className="min-h-screen p-8 text-red-600">{error}</main>;
  }
  if (dish === undefined) {
    return <main className="min-h-screen p-8 text-gray-500">読み込み中…</main>;
  }
  if (dish === null) {
    return <main className="min-h-screen p-8">料理が見つかりません</main>;
  }
  if (dish.ownerUid !== user?.uid) {
    return <main className="min-h-screen p-8">表示権限がありません</main>;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between mb-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← 一覧へ
          </Link>
          <Link
            href={`/dish/${dish.id}/edit`}
            className="text-sm text-blue-600 hover:underline"
          >
            編集
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-4">
          {dish.name}
          {dish.isSpecial && (
            <span className="ml-2 text-sm px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded align-middle">
              ★
            </span>
          )}
        </h1>
        {dish.imagePath && (
          <DishImage
            imagePath={dish.imagePath}
            alt={dish.name}
            className="w-full max-h-96 object-cover rounded mb-6"
          />
        )}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="inline font-semibold">ジャンル: </dt>
            <dd className="inline">{genreLabel(dish.genre)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">調理日時: </dt>
            <dd className="inline">{formatDateTime(dish.cookedAt)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">yearMonth: </dt>
            <dd className="inline">{dish.yearMonth}</dd>
          </div>
          <div>
            <dt className="font-semibold mb-1">メモ:</dt>
            <dd className="whitespace-pre-wrap">{dish.note || "(未設定)"}</dd>
          </div>
          {dish.ingredients.length > 0 && (
            <div>
              <dt className="font-semibold mb-1">材料:</dt>
              <dd>
                <ul className="list-disc list-inside space-y-1">
                  {dish.ingredients.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {dish.steps.length > 0 && (
            <div>
              <dt className="font-semibold mb-1">手順:</dt>
              <dd>
                <ol className="list-decimal list-inside space-y-1">
                  {dish.steps.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ol>
              </dd>
            </div>
          )}
          {dish.isAiGenerated && (
            <div className="pt-2">
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                AI 生成の下書き
              </span>
            </div>
          )}
        </dl>
      </div>
    </main>
  );
}

export default function DishDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <AuthGuard>
      <Content id={params.id} />
    </AuthGuard>
  );
}
