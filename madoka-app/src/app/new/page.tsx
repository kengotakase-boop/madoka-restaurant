"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { createDish, updateDishImagePath } from "@/lib/dishes";
import { uploadDishImage } from "@/lib/storage";
import {
  GENRE_IDS,
  GENRE_LABELS,
  type GenreId,
} from "@/constants/genre";
import { IMAGES_ENABLED } from "@/config/features";

type GenerateResponse = {
  ingredients: string[];
  steps: string[];
  note: string;
};

function NewContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<GenreId>("washoku");
  const [note, setNote] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [cookedAt, setCookedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [aiRequest, setAiRequest] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [aiOriginal, setAiOriginal] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("先に料理名を入力してください");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, request: aiRequest.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown" }));
        alert(`AI 生成に失敗しました: ${err.error ?? res.statusText}`);
        return;
      }
      const data = (await res.json()) as GenerateResponse;
      setIngredients(Array.isArray(data.ingredients) ? data.ingredients : []);
      setSteps(Array.isArray(data.steps) ? data.steps : []);
      if (typeof data.note === "string") setNote(data.note);
      setIsAiGenerated(true);
      setAiOriginal(JSON.stringify(data));
    } catch (e) {
      console.error(e);
      alert("AI 生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const cookedDate = cookedAt ? new Date(cookedAt) : new Date();
      const id = await createDish({
        name: name.trim(),
        genre,
        note: note.trim(),
        isSpecial,
        cookedAt: cookedDate,
        ownerUid: user.uid,
        ingredients,
        steps,
        isAiGenerated,
        aiOriginal,
      });
      if (IMAGES_ENABLED && file) {
        try {
          const imagePath = await uploadDishImage(file, user.uid, id);
          await updateDishImagePath(id, imagePath);
        } catch (upErr) {
          console.error(upErr);
          alert("料理は保存されましたが、画像のアップロードに失敗しました");
        }
      }
      router.replace(`/dish/${id}`);
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← 戻る
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">新規登録</h1>
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

          <div className="border rounded p-3 bg-purple-50 space-y-2">
            <label className="block text-sm font-semibold text-purple-900">
              AI でレシピ下書き生成
            </label>
            <input
              type="text"
              value={aiRequest}
              onChange={(e) => setAiRequest(e.target.value)}
              placeholder="追加の要望（例: 辛さ控えめ、子供向け）※任意"
              className="w-full border rounded px-3 py-2 bg-white text-sm"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 hover:bg-purple-700"
            >
              {generating ? "生成中…" : "AI でレシピ生成"}
            </button>
            {isAiGenerated && (
              <p className="text-xs text-purple-700">
                ✓ 生成済み（保存時 isAiGenerated=true）
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">ジャンル *</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as GenreId)}
              className="w-full border rounded px-3 py-2 bg-white"
            >
              {GENRE_IDS.map((id) => (
                <option key={id} value={id}>
                  {GENRE_LABELS[id]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">メモ</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {ingredients.length > 0 && (
            <div>
              <label className="block text-sm mb-1">材料</label>
              <ul className="list-disc list-inside space-y-1 text-sm border rounded p-3 bg-gray-50">
                {ingredients.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <label className="block text-sm mb-1">手順</label>
              <ol className="list-decimal list-inside space-y-1 text-sm border rounded p-3 bg-gray-50">
                {steps.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">調理日時</label>
            <input
              type="datetime-local"
              value={cookedAt}
              onChange={(e) => setCookedAt(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              未入力の場合は現在時刻を使用
            </p>
          </div>

          {IMAGES_ENABLED && (
            <div>
              <label className="block text-sm mb-1">画像</label>
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
            {saving ? "保存中…" : "保存"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function NewPage() {
  return (
    <AuthGuard>
      <NewContent />
    </AuthGuard>
  );
}
