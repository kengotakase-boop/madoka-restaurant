import { IMAGES_ENABLED } from "@/config/features";
import { requirePrivateImageBucket } from "../../_dishImageStorage";

export const runtime = "nodejs";

export async function GET() {
  let available = false;
  if (IMAGES_ENABLED) {
    try { await requirePrivateImageBucket(); available = true; } catch { /* fail closed */ }
  }
  return Response.json({ available }, { headers: { "Cache-Control": "private, no-store" } });
}
