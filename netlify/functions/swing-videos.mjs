/**
 * /api/swing-videos — owner-curated gallery of additional swing videos.
 *
 * GET     → public, returns every saved video as JSON.
 * POST    → owner only, appends one video. Body: { title, videoUrl }.
 * DELETE  → owner only, removes one video by ?id=<_id>.
 *
 * Storage: one JSON document per golfer in Supabase (golfer_docs table,
 * key "swing-videos"), reached through _lib/tenant.mjs. Which golfer comes from
 * the X-Golfer header or the request's domain.
 *
 * Owner auth: a Supabase access token in `Authorization: Bearer <token>`,
 * whose user must own this golfer. Same check in every function.
 *
 * URL validation is delegated to `_lib/url-classify.mjs` so the rules
 * stay in one place and stay consistent with /api/featured-swing.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight } from "./_lib/http.mjs";
import { classifyVideoUrl } from "./_lib/url-classify.mjs";

const BLOB_KEY   = "swing-videos";

// ⚠️ Hard ceiling on how many videos the gallery can hold at once.
// Mirrored on the client (MAX_VIDEOS in SwingVideos). Keep BOTH in sync
// or the UX will lie about why the upload failed.
const MAX_VIDEOS = 2;





async function readAll(store) {
  const data = await store.get(BLOB_KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

// Validate + normalize a video submission. Rejects unsupported URLs at the
// source so we never persist garbage that the frontend can't render.
function normalizeVideo(input) {
  if (!input || typeof input !== "object") return { error: "Invalid body" };
  const title    = (input.title    || "").toString().trim();
  const videoUrl = (input.videoUrl || "").toString().trim();
  if (!title)    return { error: "Title is required" };
  if (!videoUrl) return { error: "Video URL is required" };
  if (title.length > 100) return { error: "Title is too long (max 100 chars)" };

  const { kind, embedUrl } = classifyVideoUrl(videoUrl);
  if (!kind) {
    return { error: "Unsupported video URL — use YouTube, Vimeo, or a direct .mp4/.webm link." };
  }

  return {
    video: {
      _id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title,
      videoUrl,
      embedUrl,
      kind,
      addedAt:  new Date().toISOString(),
    },
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();

  // Strong consistency = read-after-write guaranteed. Worth the small
  // latency cost so the owner never sees their freshly-added clip vanish
  // on the next render.
  // This golfer's data only. A 404 here means no golfer lives at this
  // address -- see _lib/tenant.mjs.
  const t = await tenant(req);
  if (t.error) return t.error;
  const store = t.store;
  const url   = new URL(req.url);

  // ---- GET: public read ----
  if (req.method === "GET") {
    const data = await readAll(store);
    return json(200, { videos: data });
  }

  // ---- POST: owner adds a video ----
  if (req.method === "POST") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    let body;
    try { body = await req.json(); }
    catch { return json(400, { error: "Invalid JSON body" }); }

    const result = normalizeVideo(body);
    if (result.error) return json(400, { error: result.error });

    const current = await readAll(store);
    // Hard cap. Frontend already hides the form at the limit, but the
    // server is the real gatekeeper — a curl POST gets the same 409.
    if (current.length >= MAX_VIDEOS) {
      return json(409, {
        error: `Gallery is full (limit: ${MAX_VIDEOS}). Delete a video before adding another.`,
      });
    }
    current.unshift(result.video);
    await store.setJSON(BLOB_KEY, current);
    return json(201, { video: result.video });
  }

  // ---- DELETE: owner removes a video ----
  if (req.method === "DELETE") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    const id = url.searchParams.get("id");
    if (!id) return json(400, { error: "id query param required" });

    const current = await readAll(store);
    const target  = current.find((v) => v._id === id);
    if (!target) return json(404, { error: "Not found" });

    const next = current.filter((v) => v._id !== id);
    await store.setJSON(BLOB_KEY, next);


    return json(200, { ok: true, deletedId: id });
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/swing-videos" };
