"use client";
import { useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import DishImage from "@/components/DishImage";
import { getAllDishes } from "@/lib/dishes";
import { getHeroImage, setHeroImage } from "@/lib/hero";
import { GENRE_IDS, genreLabel, type GenreId } from "@/constants/genre";
import { filterDishes, sortDishesByRegistration, type RegistrationOrder } from "@/lib/dishSearch";
import { IMAGES_ENABLED } from "@/config/features";
import type { Dish } from "@/types/dish";
import styles from "./home.module.css";

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

function HomeContent() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [heroImage, setHeroImageState] = useState<string | null>(null);
  const [heroSaving, setHeroSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<GenreId | "all">("all");
  const [registrationOrder, setRegistrationOrder] = useState<RegistrationOrder>("newest");
  const [listAttempt, setListAttempt] = useState(0);

  const filteredDishes = useMemo(
    () => sortDishesByRegistration(filterDishes(dishes, query, selectedGenre), registrationOrder),
    [dishes, query, selectedGenre, registrationOrder],
  );
  const hasFilters = query !== "" || selectedGenre !== "all";
  const clearFilters = () => {
    setQuery("");
    setSelectedGenre("all");
  };

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

    return () => {
      mounted = false;
    };
  }, [listAttempt]);

  useEffect(() => {
    let mounted = true;

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
    <main className={styles.album}>
      <section className={styles.hero} aria-label="まどかレストラン">
        <NextImage
          src={heroImage ?? DEFAULT_HERO_IMAGE}
          alt=""
          fill
          sizes="(max-width: 1120px) 100vw, 1120px"
          preload
          unoptimized={heroImage !== null}
          className="object-cover object-[center_48%] grayscale brightness-[0.86] contrast-[1.08]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.2)_42%,rgba(0,0,0,0.72)_100%)]"
          aria-hidden
        />
        <div className={styles.heroContent}>
          <div className={styles.heroActions}>
            <Link href="/new" className={styles.addDish}>＋料理を登録</Link>
          </div>
          <div className={styles.heroBottom}>
            <div>
              <h1 className={styles.title}>madoka</h1>
              <p className={styles.subtitle}>Restaurant</p>
            </div>
            <label className={styles.changeBackground}>
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
          </div>
        </div>
      </section>

      <section id="records" className={styles.records} aria-labelledby="album-heading">
        <h2 id="album-heading" className={styles.heading}>家族の料理アルバム</h2>
        <div role="search" aria-label="料理を探す" className={styles.searchControls}>
          <label htmlFor="dish-search" className="sr-only">料理名・メモ・ジャンルで検索</label>
          <input
            id="dish-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="料理名・メモ・ジャンルで検索"
            className={styles.searchInput}
          />
          <div role="group" aria-label="ジャンルで絞り込み" className={styles.genres}>
            {(["all", ...GENRE_IDS] as const).map((genre) => (
              <button
                type="button"
                key={genre}
                aria-pressed={selectedGenre === genre}
                onClick={() => setSelectedGenre(genre)}
                className={styles.genreButton}
              >
                {selectedGenre === genre && <span aria-hidden>✓ </span>}
                {genre === "all" ? "すべて" : genreLabel(genre)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.resultsBar}>
          <p role="status" aria-live="polite" aria-atomic="true">
            {listLoading ? "料理を読み込み中…" : error ? "料理を取得できませんでした" : `${filteredDishes.length}皿${hasFilters ? ` ／ 全${dishes.length}皿` : ""}`}
          </p>
          {hasFilters && <button type="button" onClick={clearFilters} className={styles.clearButton}>条件を解除</button>}
          <div role="group" aria-label="登録順" className={styles.sortControls}>
            <span>登録順：</span>
            {(["newest", "oldest"] as const).map((order) => (
              <button type="button" key={order} aria-pressed={registrationOrder === order}
                onClick={() => setRegistrationOrder(order)} className={styles.sortButton}>
                {order === "newest" ? "新しい順" : "古い順"}
              </button>
            ))}
          </div>
        </div>
        {listLoading ? (
          <div className={styles.loadingGrid} aria-hidden>
            {[0, 1, 2, 3].map((key) => <div key={key} className={styles.loadingCard} />)}
          </div>
        ) : error ? (
          <div className={styles.emptyState} role="alert">
            <p>{error}。通信環境を確認して、もう一度お試しください。</p>
            <button type="button" className={styles.retryButton} onClick={() => {
              setError(null);
              setListLoading(true);
              setListAttempt((attempt) => attempt + 1);
            }}>もう一度読み込む</button>
          </div>
        ) : dishes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>まだ料理が登録されていません。</p>
            <p>「＋料理を登録」から、家族の一皿を残してみませんか。</p>
          </div>
        ) : filteredDishes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>条件に合う料理が見つかりませんでした。</p>
            <p>言葉やジャンルを変えるか、「条件を解除」で全ての料理を表示できます。</p>
          </div>
        ) : (
            <ul className={styles.grid} aria-label="料理一覧">
              {filteredDishes.map((d) => (
                <li key={d.id} className={styles.card}>
                  <Link
                    href={`/dish/${d.id}`}
                    className={styles.cardLink}
                  >
                    <div className={styles.photo}>
                    {IMAGES_ENABLED && d.imagePath ? (
                      <DishImage
                        imagePath={d.imagePath}
                        updatedAt={d.updatedAt?.toDate().getTime()}
                        alt={d.name}
                        className={styles.dishImage}
                      />
                    ) : (
                      <div
                        className={styles.noPhoto}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={styles.noPhotoIcon}
                          aria-hidden
                        >
                          <path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2" />
                          <path d="M7 2v20" />
                          <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" />
                        </svg>
                        <span>写真なし</span>
                      </div>
                    )}
                      {d.isSpecial && (
                        <span aria-label="Special" className={styles.special}>★</span>
                      )}
                    </div>
                    <div className={styles.cardText}>
                      <h3 className={styles.dishName}>{d.name}</h3>
                      <span className={styles.genreLabel}>{genreLabel(d.genre)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
        )}
      </section>
    </main>
  );
}

export default function Home() {
  return <HomeContent />;
}
