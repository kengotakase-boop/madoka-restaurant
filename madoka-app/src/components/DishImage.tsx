"use client";
import { useState } from "react";
import { getDishImageUrl } from "@/lib/storage";

type Props = {
  imagePath: string;
  alt?: string;
  className?: string;
};

export default function DishImage({ imagePath, alt, className }: Props) {
  if (!imagePath) return null;
  return <ImageContent key={imagePath} imagePath={imagePath} alt={alt} className={className} />;
}

function ImageContent({ imagePath, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const src = getDishImageUrl(imagePath);
  if (!src || failed) {
    return <span className={`${className ?? ""} flex min-h-16 items-center justify-center bg-[#f5f5f5] p-2 text-xs text-[#888]`} role="img" aria-label={`${alt ?? "料理"}：写真を表示できません`}>写真を表示できません</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ""} className={className} onError={() => setFailed(true)} loading="lazy" />;
}
