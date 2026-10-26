/**
 * /api/theme — owner-customizable site color scheme.
 *
 * GET     → public. Returns the saved theme { primary, accent } or `{}`
 *           if nothing's been customized. Frontend uses {} to mean
 *           "fall back to the hardcoded :root defaults."
 * PUT     → owner only. Body: { primary?, accent? } as #RRGGBB hex.
 *           Either field can be omitted to leave that color at its
 *           default; an empty/missing field doesn't get persisted.
 * DELETE  → owner only. Wipes the theme blob entirely ("Reset to
 *           Defaults"), so the site reverts to its original green.
 *
 * Storage: one JSON document per golfer in Supabase (golfer_docs table,
 * key "theme"), reached through _lib/tenant.mjs. Which golfer comes from
 * the X-Golfer header or the request's domain.
 *
 * Owner auth: a Supabase access token in `Authorization: Bearer <token>`,
 * whose user must own this golfer. Same check in every function.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight } from "./_lib/http.mjs";

const BLOB_KEY   = "theme";

// Strict hex-color regex: exactly 6 hex digits, leading # required.
// The <input type="color"> element only ever emits this format, so
// rejecting anything else also rejects copy-paste mistakes upstream.
const HEX_RE = /^#[0-9a-f]{6}$/i;

const ALLOWED_FIELDS = new Set(["primary", "accent"]);





// Keep only whitelisted, well-formed hex fields. Anything else is
// silently dropped — defense in depth against a buggy client.
function normalize(body) {
  if (!body || typeof body !== "object") return {};
  const out = {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const v = (body[key] ?? "").toString().trim().toLowerCase();
    if (!HEX_RE.test(v)) continue;
    out[key] = v;
  }
  return out;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();

  // Strong consistency — small latency cost, no "where'd my theme go?"
  // race after save. Same trade-off as our other owner endpoints.
  // This golfer's data only. A 404 here means no golfer lives at this
  // address -- see _lib/tenant.mjs.
  const t = await tenant(req);
  if (t.error) return t.error;
  const store = t.store;

  if (req.method === "GET") {
    const data = await store.get(BLOB_KEY, { type: "json" });
    return json(200, (data && typeof data === "object") ? data : {});
  }

  if (req.method === "PUT") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    let body;
    try { body = await req.json(); }
    catch { return json(400, { error: "Invalid JSON body" }); }

    const next = normalize(body);
    await store.setJSON(BLOB_KEY, next);
    return json(200, next);
  }

  if (req.method === "DELETE") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });
    await store.delete(BLOB_KEY);
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/theme" };
