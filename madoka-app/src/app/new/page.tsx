"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDish } from "@/lib/dishes";
import { uploadDishImage } from "@/lib/storage";
import { IMAGE_ACCEPT, imageFileError } from "@/lib/imageRules";
import ImageStorageNote from "@/components/ImageStorageNote";
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

export default function NewPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<GenreId>("washoku");
  const [note, setNote] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [cookedAt, setCookedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [location, setLocation] = useState("自宅");
  const [storeName, setStoreName] = useState("");
  const [wantToCook, setWantToCook] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectPhoto = (selected: File | undefined) => {
    if (!selected) return;
    const error = imageFileError(selected);
    if (error) {
      setPhotoError(error);
      return;
    }
    setPhotoError("");
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

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
    setSaving(true);
    try {
      const cookedDate = cookedAt ? new Date(cookedAt) : new Date();
      const id = await createDish({
        name: name.trim(),
        genre,
        note: note.trim(),
        isSpecial,
        cookedAt: cookedDate,
        ingredients,
        steps,
        isAiGenerated,
        aiOriginal,
      });
      if (file) {
        try {
          if (!IMAGES_ENABLED) throw new Error("写真機能は停止中です。");
          await uploadDishImage(file, id);
        } catch (upErr) {
          alert(`料理は保存されましたが、写真の保存を確認できませんでした。${upErr instanceof Error ? upErr.message : "詳細画面から確認してください。"}`);
        }
      }
      router.replace(`/dish/${id}`);
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
      setSaving(false);
    }
  };

  const labelClass = "mb-2 block text-[10px] uppercase tracking-[2px] text-[#888]";
  const inputClass = "w-full min-w-0 rounded-none border border-[#ddd] bg-[#fafafa] px-[14px] py-3 text-[13px] leading-normal text-[#111] outline-none focus:border-[#C9A84C]";
  const buttonClass = "w-full cursor-pointer bg-[#111] p-[14px] text-[12px] tracking-[2px] text-white hover:bg-[#292929] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:cursor-wait disabled:bg-[#aaa]";
  const hintClass = "mt-2 text-[11px] leading-relaxed text-[#888]";
  const toggleClass = "flex w-full cursor-pointer items-center gap-[10px] border px-[14px] py-3 text-left text-[13px] text-[#555] focus-visible:outline-2 focus-visible:outline-[#C9A84C]";

  return (
    <main className="min-h-screen bg-white text-[#111] leading-normal">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#eee] bg-white px-5 py-4">
        <Link href="/" aria-label="トップへ戻る" className="text-[22px] leading-normal text-[#333] focus-visible:outline-2 focus-visible:outline-[#C9A84C]">
          ←
        </Link>
        <h1 className="text-[15px] font-bold tracking-[1px]">NEW DISH</h1>
      </header>
      <form onSubmit={handleSubmit} className="space-y-5 p-5">
        <div>
          <label htmlFor="dish-name" className={labelClass}>料理名</label>
          <input id="dish-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 肉じゃが" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="dish-genre" className={labelClass}>カテゴリ</label>
            <select id="dish-genre" value={genre} onChange={(e) => setGenre(e.target.value as GenreId)} className={inputClass + " appearance-none"}>
              {GENRE_IDS.map((id) => <option key={id} value={id}>{GENRE_LABELS[id]}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="dish-location" className={labelClass}>場所</label>
            <select id="dish-location" value={location} onChange={(e) => setLocation(e.target.value)} aria-describedby="location-note" className={inputClass + " appearance-none"}>
              <option>自宅</option>
              <option>外食</option>
            </select>
          </div>
        </div>
        {location === "外食" && (
          <div>
            <label htmlFor="dish-store" className={labelClass}>お店の名前</label>
            <input id="dish-store" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="例: 丸乃内 池袋店" aria-describedby="location-note" className={inputClass} />
          </div>
        )}

        <div>
          <button type="button" aria-pressed={isSpecial} onClick={() => setIsSpecial(!isSpecial)} className={toggleClass + (isSpecial ? " border-[#C9A84C] bg-[#fffbf0]" : " border-[#ddd] bg-[#fafafa]")}>
            <span aria-hidden="true" className={isSpecial ? "text-[#C9A84C]" : ""}>{isSpecial ? "★" : "☆"}</span>
            Specialにする
          </button>
          <button type="button" aria-pressed={wantToCook} aria-describedby="location-note" onClick={() => setWantToCook(!wantToCook)} className={toggleClass + " mt-2" + (wantToCook ? " border-[#C9A84C] bg-[#fffbf0]" : " border-[#ddd] bg-[#fafafa]")}>
            <span aria-hidden="true" className={wantToCook ? "text-[#C9A84C]" : ""}>{wantToCook ? "▲" : "△"}</span>
            作りたいリストに追加
          </button>
          <p id="location-note" className={hintClass}>場所・お店の名前・作りたいリストは保存未対応です。</p>
        </div>

        <div>
          <label htmlFor="dish-note" className={labelClass}>メモ</label>
          <textarea id="dish-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="味の印象、なぜこの料理など..." className={inputClass + " block min-h-20 resize-y"} />
        </div>

        <div>
          <label htmlFor="dish-photo" className={labelClass}>写真</label>
          <input ref={photoInput} id="dish-photo" type="file" accept={IMAGE_ACCEPT} className="sr-only" aria-describedby="photo-note" onChange={(e) => { selectPhoto(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          {previewUrl && (
            <div className="mb-2">
              {/* Preview stays local; only the re-encoded image is sent on save. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="選択した写真のプレビュー" className="max-h-[200px] w-full object-contain" onError={() => setPhotoError("この画像はプレビューできません。JPEG・PNGなどの画像を選び直してください。")} />
              <p className={hintClass + " break-all"}>選択中: {file?.name}</p>
              <button type="button" className="mt-1 text-[11px] text-[#555] underline" onClick={() => { setFile(null); setPreviewUrl(null); setPhotoError(""); }}>写真の選択を解除</button>
            </div>
          )}
          <button type="button" onClick={() => photoInput.current?.click()} className="w-full cursor-pointer border-2 border-dashed border-[#ddd] bg-[#fafafa] p-[14px] text-center text-[12px] text-[#888] hover:border-[#C9A84C] focus-visible:outline-2 focus-visible:outline-[#C9A84C]">写真を選択</button>
          <ImageStorageNote id="photo-note" className={hintClass} />
          {photoError && <p role="alert" className={hintClass}>{photoError}</p>}
        </div>

        <div>
          <h2 className={labelClass}>AIレシピ</h2>
          <button type="button" onClick={handleGenerate} disabled={generating || saving} className={buttonClass}>
            {generating ? "生成中…" : "AIでレシピを生成"}
          </button>
          <details className="mt-2 text-[11px] text-[#888]">
            <summary className="cursor-pointer">追加の要望（任意）</summary>
            <label htmlFor="ai-request" className="sr-only">AIへの追加の要望</label>
            <input id="ai-request" type="text" value={aiRequest} onChange={(e) => setAiRequest(e.target.value)} placeholder="例: 辛さ控えめ、子供向け" className={inputClass + " mt-2"} />
          </details>
          {isAiGenerated && <p role="status" className={hintClass}>レシピを生成しました。材料・手順は料理と一緒に保存されます。</p>}
          {(ingredients.length > 0 || steps.length > 0) && (
            <div className="mt-3 space-y-3 border border-[#eee] bg-[#f9f9f9] p-[14px] text-[12px] leading-[1.7] text-[#555]">
              {ingredients.length > 0 && <div><h3 className="mb-1 font-medium">材料</h3><ul className="list-inside list-disc">{ingredients.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
              {steps.length > 0 && <div><h3 className="mb-1 font-medium">手順</h3><ol className="list-inside list-decimal">{steps.map((v, i) => <li key={i}>{v}</li>)}</ol></div>}
            </div>
          )}
        </div>

        <details className="text-[11px] text-[#888]">
          <summary className="cursor-pointer">調理日時（未指定は現在時刻）</summary>
          <label htmlFor="cooked-at" className="sr-only">調理日時</label>
          <input id="cooked-at" type="datetime-local" value={cookedAt} onChange={(e) => setCookedAt(e.target.value)} className={inputClass + " mt-2"} />
        </details>
        <button type="submit" disabled={saving || generating} className={buttonClass + " !p-4 !tracking-[3px]"}>
          {saving ? "保存中…" : "保存"}
        </button>
      </form>
    </main>
  );
}

