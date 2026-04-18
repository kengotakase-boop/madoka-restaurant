"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DishImage from "@/components/DishImage";
import { formatDateTimeJst } from "@/lib/date";
import { getAllDishes } from "@/lib/dishes";
import { genreLabel } from "@/constants/genre";
import { IMAGES_ENABLED } from "@/config/features";
import type { Dish } from "@/types/dish";

function formatDate(ts: Dish["cookedAt"] | null): string {
  if (!ts) return "";
  const d = ts.toDate();
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function HomeContent() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // 料理名・メモ・ジャンル（表示ラベル）を対象に部分一致。空なら全件返し、並び順は維持。
  const filteredDishes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dishes;
    return dishes.filter((d) => {
      return (
        d.name.toLowerCase().includes(q) ||
        d.note.toLowerCase().includes(q) ||
        genreLabel(d.genre).toLowerCase().includes(q)
      );
    });
  }, [dishes, query]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getAllDishes();
        if (mounted) setDishes(list);
      } catch (e) {
        console.error(e);
        if (mounted) setError("一覧の取得に失敗しました");
      } finally {
        if (mounted) setListLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <section className="relative border-b border-gray-100 px-6 py-14 md:py-20">
        <div className="max-w-xl mx-auto">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-5">
            Our Family Cookbook
          </p>
          <h1 className="font-serif font-light text-[44px] md:text-6xl text-gray-900 leading-none">
            madoka
          </h1>
          <p className="font-serif italic text-[46px] md:text-[60px] leading-[1.05] text-[#C9A84C]">
            Restaurant
          </p>
          <div aria-hidden className="mt-5 mb-8 h-[2px] w-8 bg-[#C9A84C]" />
          <Link
            href="/new"
            className="block w-full text-center px-6 py-[18px] bg-gray-900 text-white text-[15px] font-medium tracking-[0.18em] rounded-sm shadow-sm hover:bg-black hover:shadow-[0_14px_30px_-12px_rgba(201,168,76,0.35)] hover:-translate-y-[1px] active:translate-y-0 active:shadow-sm transition-all duration-200"
          >
            ＋ 今日の一皿を記録する
          </Link>
          <a
            href="#records"
            className="block text-center text-xs tracking-[0.2em] text-gray-400 hover:text-gray-900 mt-5 py-2 transition"
          >
            みんなの記録を見る ↓
          </a>
        </div>
      </section>

      <section id="records" className="max-w-2xl mx-auto px-6 py-10 md:py-12">
        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}
        {listLoading ? (
          <p className="text-gray-400 text-sm text-center py-10">読み込み中…</p>
        ) : dishes.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-14">
            最初の一皿を記録してみよう
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-serif text-2xl text-gray-900">最近の記録</h2>
              <span className="text-[10px] tracking-[0.25em] text-gray-400 uppercase">
                {filteredDishes.length} 皿
              </span>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="料理名・メモで検索"
              className="w-full mb-6 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:border-gray-500 focus:bg-white transition-colors duration-200"
            />
            {filteredDishes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">
                該当する記録がありません
              </p>
            ) : (
            <ul className="space-y-2.5">
              {filteredDishes.map((d) => (
                <li
                  key={d.id}
                  className="border border-gray-100 rounded-lg hover:border-gray-200 hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.08)] active:shadow-sm active:translate-y-[0.5px] transition-all duration-200"
                >
                  <Link
                    href={`/dish/${d.id}`}
                    className="flex gap-4 items-start p-4"
                  >
                    {IMAGES_ENABLED && d.imagePath ? (
                      <DishImage
                        imagePath={d.imagePath}
                        alt={d.name}
                        className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="w-14 h-14 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-5 h-5 text-gray-300"
                        >
                          <path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2" />
                          <path d="M7 2v20" />
                          <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <h3 className="text-[17px] font-semibold text-gray-900 truncate leading-snug">
                          {d.name}
                        </h3>
                        {d.isSpecial && (
                          <span
                            aria-label="Special"
                            className="text-[15px] text-[#C9A84C] flex-shrink-0 leading-none"
                          >
                            ★
                          </span>
                        )}
                      </div>
                      {d.note && (
                        <p className="text-[13px] text-gray-500 truncate mb-1.5 leading-snug">
                          {d.note}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <span className="flex-shrink-0">{genreLabel(d.genre)}</span>
                        <span aria-hidden className="text-gray-200">
                          ·
                        </span>
                        <span className="flex-shrink-0 text-gray-300">
                          {formatDate(d.cookedAt)}
                        </span>
                        {(() => {
                          const ts = d.updatedAt ?? d.createdAt;
                          const s = formatDateTimeJst(ts);
                          return s ? (
                            <>
                              <span aria-hidden className="text-gray-200">
                                ·
                              </span>
                              <span className="flex-shrink-0 text-gray-300">
                                更新 {s}
                              </span>
                            </>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default function Home() {
  return <HomeContent />;
}
