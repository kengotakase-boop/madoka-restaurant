"use client";
import { useEffect, useState } from "react";
import { IMAGES_ENABLED } from "@/config/features";

export default function ImageStorageNote({ className, id }: { className?: string; id?: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/images/status", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => response.ok && (await response.json()).available === true)
      .then(setAvailable)
      .catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, []);
  return <p id={id} className={className} role="status">
    JPEG・PNG・WebP／10MBまで。送信時に縮小します。
    {!IMAGES_ENABLED || available === false ? " 現在、写真保存先は未設定または利用できません。プレビューのみ利用でき、料理データは保存できます。" :
      available === null ? " 写真保存先を確認中です。" : " 料理の保存後に写真を保存します。"}
  </p>;
}
