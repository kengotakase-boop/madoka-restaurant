"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DishImage from "@/components/DishImage";
import { formatDateTimeJst } from "@/lib/date";
import { getDishById } from "@/lib/dishes";
import { genreLabel } from "@/constants/genre";
import { IMAGES_ENABLED } from "@/config/features";
import type { Dish } from "@/types/dish";

function Content({ id }: { id: string }) {
  const [dish, setDish] = useState<Dish | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [id]);

  if (error) {
    return <main className="min-h-screen p-8 text-red-600">{error}</main>;
  }
  if (dish === undefined) {
    return <main className="min-h-screen p-8 text-gray-500">読み込み中…</main>;
  }
  if (dish === null) {
    return <main className="min-h-screen p-8">料理が見つかりません</main>;
  }

  const updatedStr = formatDateTimeJst(dish.updatedAt ?? dish.createdAt);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-6 py-8 md:py-12">
        <div className="flex justify-between mb-10">
          <Link
            href="/"
            className="text-xs tracking-[0.15em] text-gray-500 hover:text-gray-900 transition"
          >
            ← 一覧へ
          </Link>
          <Link
            href={`/dish/${dish.id}/edit`}
            className="text-xs tracking-[0.15em] text-gray-500 hover:text-gray-900 transition"
          >
            編集
          </Link>
        </div>

        <header className="mb-5">
          <h1 className="font-serif text-[28px] md:text-[34px] font-semibold text-gray-900 leading-tight">
            {dish.name}
            {dish.isSpecial && (
              <span
                aria-label="Special"
                className="ml-3 text-2xl text-[#C9A84C] align-middle leading-none"
              >
                ★
              </span>
            )}
          </h1>
        </header>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400 pb-6 mb-8 border-b border-gray-100">
          <span>{genreLabel(dish.genre)}</span>
          <span aria-hidden className="text-gray-200">·</span>
          <span>{formatDateTimeJst(dish.cookedAt)}</span>
          {updatedStr && (
            <>
              <span aria-hidden className="text-gray-200">·</span>
              <span>更新 {updatedStr}</span>
            </>
          )}
        </div>

        {IMAGES_ENABLED && dish.imagePath && (
          <DishImage
            imagePath={dish.imagePath}
            alt={dish.name}
            className="w-full max-h-96 object-cover rounded-md mb-8"
          />
        )}

        <section className="mb-10">
          <h2 className="text-[10px] tracking-[0.25em] text-gray-400 uppercase mb-3">
            メモ
          </h2>
          <p className="text-[15px] leading-[1.8] text-gray-800 whitespace-pre-wrap">
            {dish.note || (
              <span className="text-gray-400">(未設定)</span>
            )}
          </p>
        </section>

        {dish.ingredients.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[10px] tracking-[0.25em] text-gray-400 uppercase mb-3">
              材料
            </h2>
            <ul className="list-disc list-inside space-y-1.5 text-[14px] text-gray-800 leading-relaxed">
              {dish.ingredients.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </section>
        )}

        {dish.steps.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[10px] tracking-[0.25em] text-gray-400 uppercase mb-3">
              手順
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-[14px] text-gray-800 leading-[1.75]">
              {dish.steps.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ol>
          </section>
        )}

        {dish.isAiGenerated && (
          <div className="pt-6 border-t border-gray-100">
            <span className="inline-block text-[10px] tracking-[0.2em] text-purple-600 uppercase">
              ✦ AI 生成の下書き
            </span>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DishDetailPage() {
  const params = useParams<{ id: string }>();
  return <Content id={params.id} />;
}
