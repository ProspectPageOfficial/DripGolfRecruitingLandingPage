/**
 * /api/featured-swing — the single "headline" swing video at the top of the
 * Swing Video tab. Lets the portfolio owner (parent/kid with credentials)
 * swap it without ever editing source code.
 *
 * GET → public. Returns { videoUrl, embedUrl, kind, updatedAt } or null fields
 *        if nothing has been set yet (frontend falls back to the built-in default).
 * PUT → owner only. Body: { videoUrl }. Replaces whatever was there.
 *
 * We deliberately do NOT keep a history — featured = "currently up", one video.
 * If the owner wants the previous one back they can paste it again. YAGNI.
 *
 * Storage: one JSON document per golfer in Supabase (golfer_docs table,
 * key "featured-swing"), reached through _lib/tenant.mjs. Which golfer comes from
 * the X-Golfer header or the request's domain.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight } from "./_lib/http.mjs";
import { classifyVideoUrl } from "./_lib/url-classify.mjs";

const BLOB_KEY   = "featured-swing";
const MAX_URL_LEN = 500;





export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();

  // This golfer's data only. A 404 here means no golfer lives at this
  // address -- see _lib/tenant.mjs.
  const t = await tenant(req);
  if (t.error) return t.error;
  const store = t.store;

  // ---- GET: public read ----
  if (req.method === "GET") {
    const data = await store.get(BLOB_KEY, { type: "json" });
    // Null-coalesce so the frontend can always destructure safely.
    return json(200, data || { videoUrl: null, embedUrl: null, kind: null, updatedAt: null });
  }

  // ---- PUT: owner-only update ----
  if (req.method === "PUT") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    let body;
    try { body = await req.json(); }
    catch { return json(400, { error: "Invalid JSON body" }); }

    const videoUrl = (body?.videoUrl || "").toString().trim().slice(0, MAX_URL_LEN);
    if (!videoUrl) return json(400, { error: "videoUrl is required" });

    const { kind, embedUrl } = classifyVideoUrl(videoUrl);
    if (!kind) {
      return json(400, {
        error: "Please paste a valid YouTube, Vimeo, or direct .mp4/.webm URL.",
      });
    }

    const next = {
      videoUrl,
      embedUrl,
      kind,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(BLOB_KEY, next);
    return json(200, next);
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/featured-swing" };
