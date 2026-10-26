/**
 * /api/personal — owner-edited Personal Bio fields, server-side.
 *
 * Replaces the previous localStorage-only implementation, which only
 * persisted edits on the editor's own device (so a parent editing on
 * the laptop would NOT see their changes on the phone, and neither
 * would any visitor). Now the overrides live server-side and
 * every device/browser sees the same content.
 *
 * GET     → public. Returns the overrides object, or `{}` if nothing
 *           has ever been saved. Shape is { fieldName: stringValue }.
 * PUT     → owner only. Body is the FULL overrides object — the client
 *           sends every field every save. No concept of patch.
 * DELETE  → owner only. Wipes overrides (Reset-to-Defaults).
 *
 * Storage: one JSON document per golfer in Supabase (golfer_docs table,
 * key "personal-overrides"), reached through _lib/tenant.mjs. Which golfer comes from
 * the X-Golfer header or the request's domain.
 *
 * Owner auth: a Supabase access token in `Authorization: Bearer <token>`,
 * whose user must own this golfer. Same check in every function.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight } from "./_lib/http.mjs";

const BLOB_KEY   = "personal-overrides";

// Whitelist of accepted field names. Anything else in the PUT body
// is dropped on the floor — defense in depth so a future client bug
// can't slip surprise keys into the blob. Mirror with the FIELDS
// constant in the PersonalBio client module.
export const ALLOWED_FIELDS = new Set([
  "name", "hometown", "class_year", "age", "currently_attending",
  "photo", "bio",
  // physical / contact details — surfaced on the Personal Bio tab and
  // in the visitor resume PDF. Stored as plain strings; the client
  // decides display formatting.
  "height", "weight", "home_address", "phone",
  // current coach — surfaced at the top of the Golf Bio tab and in the
  // resume PDF. Kept in the personal blob (not a new endpoint) so we
  // don't multiply the number of round-trips needed to hydrate a page.
  "coach_name", "coach_phone", "coach_email",
  // academic performance — surfaced on the Personal Bio tab next to
  // Class Year / Currently Attending. `gpa` is a free-form string
  // (e.g. "3.85 / 4.0", "4.2 weighted"); `test_scores` covers SAT/ACT
  // in whatever format the owner prefers ("1420 SAT", "31 ACT",
  // "1420 / 31"). Client decides display formatting.
  "gpa", "test_scores",
  // socials — keep aligned with SOCIAL_PLATFORMS on the client
  "instagram", "twitter", "tiktok", "youtube", "facebook", "linkedin", "website",
]);

// Generous cap — `bio` is the longest legitimate field, everything
// else is short. Anything over this is almost certainly a paste-bomb
// or someone trying to fill the blob; silently drop it rather than
// 400-ing the whole save.
const MAX_FIELD_LEN = 2000;





// Normalize the body: keep only whitelisted fields, trim strings,
// drop empties (so "clearing" a field in the form reverts to the
// hardcoded default rather than persisting an empty override).
export function normalize(body) {
  if (!body || typeof body !== "object") return {};
  const out = {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const raw = body[key];
    if (raw == null) continue;
    const v = raw.toString().trim();
    if (!v) continue;
    if (v.length > MAX_FIELD_LEN) continue;
    out[key] = v;
  }
  return out;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();

  // Strong consistency — same trade-off as /api/swing-videos. Small
  // latency hit, no "where'd my edit go?" after-save confusion.
  // This golfer's data only. A 404 here means no golfer lives at this
  // address -- see _lib/tenant.mjs.
  const t = await tenant(req);
  if (t.error) return t.error;
  const store = t.store;

  // ---- GET: public read ----
  if (req.method === "GET") {
    const data = await store.get(BLOB_KEY, { type: "json" });
    return json(200, (data && typeof data === "object") ? data : {});
  }

  // ---- PUT: owner saves the full overrides object ----
  if (req.method === "PUT") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    let body;
    try { body = await req.json(); }
    catch { return json(400, { error: "Invalid JSON body" }); }

    const next = normalize(body);
    await store.setJSON(BLOB_KEY, next);
    return json(200, next);
  }

  // ---- DELETE: owner wipes all overrides ("Reset to Defaults") ----
  if (req.method === "DELETE") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });
    await store.delete(BLOB_KEY);
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/personal" };
