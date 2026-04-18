"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import DishImage from "@/components/DishImage";
import { useAuth } from "@/hooks/useAuth";
import { getDishById, updateDish, updateDishImagePath } from "@/lib/dishes";
import { uploadDishImage } from "@/lib/storage";
import {
  GENRE_IDS,
  GENRE_LABELS,
  type GenreId,
} from "@/constants/genre";
import { IMAGES_ENABLED } from "@/config/features";
import type { Dish } from "@/types/dish";

function tsToLocalInput(ts: Dish["cookedAt"] | null): string {
  if (!ts) return "";
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Content({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [dish, setDish] = useState<Dish | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<GenreId>("washoku");
  const [note, setNote] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [cookedAt, setCookedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const d = await getDishById(id);
        if (!mounted) return;
        setDish(d);
        if (d) {
          setName(d.name);
          setGenre(d.genre);
          setNote(d.note);
          setIsSpecial(d.isSpecial);
          setCookedAt(tsToLocalInput(d.cookedAt));
        }
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
    return <main className="min-h-screen p-8">編集権限がありません</main>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const cookedDate = cookedAt ? new Date(cookedAt) : new Date();
      await updateDish(id, {
        name: name.trim(),
        genre,
        note: note.trim(),
        isSpecial,
        cookedAt: cookedDate,
      });
      if (IMAGES_ENABLED && file) {
        try {
          const imagePath = await uploadDishImage(file, user.uid, id);
          await updateDishImagePath(id, imagePath);
        } catch (upErr) {
          console.error(upErr);
          alert("情報は更新されましたが、画像のアップロードに失敗しました");
        }
      }
      router.replace(`/dish/${id}`);
    } catch (err) {
      console.error(err);
      alert("更新に失敗しました");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/dish/${id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← 詳細へ
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">編集</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">料理名 *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">ジャンル *</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as GenreId)}
              className="w-full border rounded px-3 py-2 bg-white"
            >
              {GENRE_IDS.map((g) => (
                <option key={g} value={g}>
                  {GENRE_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">メモ</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">調理日時</label>
            <input
              type="datetime-local"
              value={cookedAt}
              onChange={(e) => setCookedAt(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          {IMAGES_ENABLED && (
            <>
              <div>
                <label className="block text-sm mb-1">現在の画像</label>
                {dish.imagePath ? (
                  <DishImage
                    imagePath={dish.imagePath}
                    alt={dish.name}
                    className="w-full max-h-64 object-cover rounded border"
                  />
                ) : (
                  <p className="text-xs text-gray-500">未設定</p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">画像を差し替え</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
                {file && (
                  <p className="text-xs text-gray-500 mt-1">選択中: {file.name}</p>
                )}
              </div>
            </>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSpecial}
              onChange={(e) => setIsSpecial(e.target.checked)}
            />
            特別な料理（★）
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
          >
            {saving ? "更新中…" : "更新"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function DishEditPage() {
  const params = useParams<{ id: string }>();
  return (
    <AuthGuard>
      <Content id={params.id} />
    </AuthGuard>
  );
}
