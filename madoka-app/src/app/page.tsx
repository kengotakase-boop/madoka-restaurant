"use client";
import { useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import DishImage from "@/components/DishImage";
import { formatDateTimeJst } from "@/lib/date";
import { getAllDishes } from "@/lib/dishes";
import { getHeroImage, setHeroImage } from "@/lib/hero";
import { genreLabel } from "@/constants/genre";
import { IMAGES_ENABLED } from "@/config/features";
import type { Dish } from "@/types/dish";

const DEFAULT_HERO_IMAGE = "/images/madoka-home-exterior.jpg";

function isUsableHeroImage(src: string | null): Promise<boolean> {
  if (!src) return Promise.resolve(false);
  return new Promise((resolve) => {
    const probe = new window.Image();
    probe.onload = () => resolve(probe.naturalWidth > 1 && probe.naturalHeight > 1);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });
}

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
  const [heroImage, setHeroImageState] = useState<string | null>(null);
  const [heroSaving, setHeroSaving] = useState(false);
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

    void getAllDishes()
      .then((list) => {
        if (mounted) setDishes(list);
      })
      .catch((e) => {
        console.error(e);
        if (mounted) setError("一覧の取得に失敗しました");
      })
      .finally(() => {
        if (mounted) setListLoading(false);
      });

    void getHeroImage()
      .then(async (hero) => {
        const usable = await isUsableHeroImage(hero);
        if (mounted) setHeroImageState(usable ? hero : null);
      })
      .catch((e) => {
        console.warn("背景写真の取得に失敗したため標準背景を表示します", e);
        if (mounted) setHeroImageState(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleHeroChange = async (file: File | undefined) => {
    if (!file) return;
    setHeroSaving(true);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await setHeroImage(image);
      setHeroImageState(image);
    } catch (e) {
      console.error(e);
      alert("背景写真の保存に失敗しました");
    } finally {
      setHeroSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="relative mx-auto h-[420px] max-w-[800px] overflow-hidden bg-black">
        <NextImage
          src={heroImage ?? DEFAULT_HERO_IMAGE}
          alt=""
          fill
          sizes="(max-width: 800px) 100vw, 800px"
          preload
          unoptimized={heroImage !== null}
          className="object-cover object-[center_48%] grayscale brightness-[0.86] contrast-[1.08]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.2)_42%,rgba(0,0,0,0.72)_100%)]"
          aria-hidden
        />
        <Link
          href="/new"
          className="absolute right-4 top-4 z-10 bg-white/95 px-4 py-2.5 text-[10px] font-bold tracking-[0.24em] text-gray-950 transition hover:bg-[#C9A84C] hover:text-white sm:right-5 sm:top-5 sm:px-[18px]"
        >
          + ADD DISH
        </Link>
        <div className="absolute bottom-7 left-6 z-10">
          <p className="mb-2.5 text-[9px] uppercase tracking-[0.42em] text-white/60">
            Our Family Cookbook
          </p>
          <h1 className="font-serif text-[48px] font-light leading-none text-white">
            madoka
          </h1>
          <p className="font-serif text-[52px] italic leading-[1.06] text-[#C9A84C]">
            Restaurant
          </p>
        </div>
        <label className="absolute bottom-4 right-4 z-10 cursor-pointer bg-black/45 px-3 py-2 text-[10px] tracking-[0.16em] text-white/75 transition hover:bg-black/65 hover:text-white sm:bottom-5 sm:right-5">
            {heroSaving ? "保存中…" : "背景写真を変更"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={heroSaving}
              onChange={(e) => {
                void handleHeroChange(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
        </label>
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
                        updatedAt={d.updatedAt?.toDate().getTime()}
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
