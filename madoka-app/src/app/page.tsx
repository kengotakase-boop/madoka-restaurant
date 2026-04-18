"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DishImage from "@/components/DishImage";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
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
  const { user } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
      alert("ログアウトに失敗しました");
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="relative border-b border-gray-200 px-6 py-20">
        {user && (
          <button
            onClick={handleLogout}
            className="absolute top-4 right-4 px-3 py-1 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
          >
            ログアウト
          </button>
        )}
        <div className="max-w-xl mx-auto">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-6">
            Our Family Cookbook
          </p>
          <h1 className="font-serif font-light text-5xl text-gray-900 leading-none">
            madoka
          </h1>
          <p className="font-serif italic text-[52px] leading-[1.1] text-[#C9A84C]">
            Restaurant
          </p>
          <div aria-hidden className="mt-6 mb-6 h-[2px] w-8 bg-[#C9A84C]" />
          {user && (
            <p className="text-sm text-gray-600 mb-8">
              ようこそ、{user.displayName ?? user.email ?? "ゲスト"} さん
            </p>
          )}
          <Link
            href="/new"
            className="block w-full text-center px-6 py-4 bg-gray-900 text-white text-sm tracking-[0.2em] hover:bg-gray-800 transition"
          >
            ＋ 今日の一皿を記録する
          </Link>
          <a
            href="#records"
            className="block text-center text-xs tracking-[0.2em] text-gray-500 hover:text-gray-900 mt-4 py-2 transition"
          >
            みんなの記録を見る ↓
          </a>
        </div>
      </section>

      <section id="records" className="max-w-2xl mx-auto px-6 py-8">
        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}
        {listLoading ? (
          <p className="text-gray-500 text-sm text-center py-8">読み込み中…</p>
        ) : dishes.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-12">
            最初の一皿を記録してみよう
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-serif text-2xl text-gray-900">最近の記録</h2>
              <span className="text-[10px] tracking-[0.25em] text-gray-400 uppercase">
                {dishes.length} 皿
              </span>
            </div>
            <ul className="space-y-3">
              {dishes.map((d) => (
                <li
                  key={d.id}
                  className="border border-gray-200 rounded-md hover:bg-gray-50 transition"
                >
                  <Link
                    href={`/dish/${d.id}`}
                    className="flex gap-4 items-start p-4"
                  >
                    {IMAGES_ENABLED && d.imagePath ? (
                      <DishImage
                        imagePath={d.imagePath}
                        alt={d.name}
                        className="w-14 h-14 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="w-14 h-14 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"
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
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {d.name}
                        </h3>
                        {d.isSpecial && (
                          <span
                            aria-label="Special"
                            className="text-sm text-[#C9A84C] flex-shrink-0"
                          >
                            ★
                          </span>
                        )}
                      </div>
                      {d.note && (
                        <p className="text-xs text-gray-500 truncate mb-2">
                          {d.note}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="flex-shrink-0">{genreLabel(d.genre)}</span>
                        <span aria-hidden className="text-gray-300">
                          ·
                        </span>
                        <span className="flex-shrink-0">
                          {formatDate(d.cookedAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

export default function Home() {
  return <HomeContent />;
}
