"use client";
import { useEffect, useState } from "react";
import { getDishImageUrl } from "@/lib/storage";

type Props = {
  imagePath: string;
  alt?: string;
  className?: string;
};

export default function DishImage({ imagePath, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
    let mounted = true;
    setUrl(null);
    setFailed(false);
    (async () => {
      try {
        const u = await getDishImageUrl(imagePath);
        if (mounted) setUrl(u);
      } catch (e) {
        console.error(e);
        if (mounted) setFailed(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [imagePath]);

  if (!imagePath) return null;
  if (failed) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-gray-100 text-xs text-gray-500`}
      >
        画像を読み込めません
      </div>
    );
  }
  if (!url) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-gray-100 text-xs text-gray-400`}
      >
        ...
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt ?? ""} className={className} />;
}
