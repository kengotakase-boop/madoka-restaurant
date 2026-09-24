"use client";
import { useState } from "react";
import { getDishImageUrl } from "@/lib/storage";

type Props = {
  imagePath: string;
  updatedAt?: number;
  alt?: string;
  className?: string;
};

export default function DishImage({ imagePath, updatedAt, alt, className }: Props) {
  if (!imagePath) return null;
  const src = getDishImageUrl(imagePath, updatedAt);
  return <ImageContent key={src} src={src} alt={alt} className={className} />;
}

function ImageContent({ src, alt, className }: { src: string | null } & Pick<Props, "alt" | "className">) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={`${className ?? ""} flex min-h-16 items-center justify-center bg-[#f5f5f5] p-2 text-xs text-[#888]`} role="img" aria-label={`${alt ?? "料理"}：写真を表示できません`}>写真を表示できません</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ""} className={className} onError={() => setFailed(true)} loading="lazy" />;
}
