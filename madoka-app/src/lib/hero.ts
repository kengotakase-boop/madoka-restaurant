export async function getHeroImage(): Promise<string | null> {
  const res = await fetch("/api/hero", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { image: string | null };
  return data.image;
}

export async function setHeroImage(image: string | null): Promise<void> {
  const res = await fetch("/api/hero", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(String(err.error ?? res.statusText));
  }
}
