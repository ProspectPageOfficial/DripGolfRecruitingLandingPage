/**
 * /api/tournaments — public tournament storage.
 *
 * GET     → public, returns all user-added tournaments as JSON.
 * POST    → owner only, appends one tournament. Body: tournament object.
 * DELETE  → owner only, removes one tournament by ?id=<_id>.
 *
 * Storage: one JSON document per golfer in Supabase (golfer_docs table,
 * key "tournaments"), reached through _lib/tenant.mjs. Which golfer comes from
 * the X-Golfer header or the request's domain.
 *
 * Owner auth: a Supabase access token in `Authorization: Bearer <token>`,
 * whose user must own this golfer. Same check in every function.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight } from "./_lib/http.mjs";
import { migratePastUpcoming } from "./_lib/migrate-upcoming.mjs";

const BLOB_KEY   = "tournaments";





// Read the blob (returns [] if it doesn't exist yet — first run).
async function readAll(store) {
  const data = await store.get(BLOB_KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

// Sanitize incoming tournament input to a known shape. Keeps the blob
// schema predictable even if a malicious caller throws junk at us.
function normalizeTournament(input) {
  if (!input || typeof input !== "object") return null;
  const name = (input.name || "").toString().trim();
  if (!name) return null;
  const safeRounds = Array.isArray(input.rounds) ? input.rounds.map((r) => ({
    round:  (r.round  || "").toString(),
    score:  (r.score  || "").toString(),
    course: (r.course || "").toString(),
  })) : [];
  return {
    _id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    year:     (input.year     || new Date().getFullYear().toString()).toString(),
    date:     (input.date     || "").toString().trim(),
    name,
    division: (input.division || "").toString().trim(),
    place:    (input.place    || "").toString().trim(),
    total:    (input.total    || "").toString().trim(),
    points:   (input.points   || "").toString().trim(),
    rounds:   safeRounds,
    addedAt:  new Date().toISOString(),
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();

  // Strong consistency = read-after-write guaranteed (small latency cost,
  // worth it because reload UX should never show stale tournament data).
  // This golfer's data only. A 404 here means no golfer lives at this
  // address -- see _lib/tenant.mjs.
  const t = await tenant(req);
  if (t.error) return t.error;
  const store = t.store;
  const url   = new URL(req.url);

  // ---- GET: public read ----
  // Run the upcoming→played migration before reading. Means History
  // always shows graduated entries even when the visitor hasn't opened
  // the Upcoming tab yet (and vice-versa). Idempotent — cheap no-op
  // when there's nothing past-due.
  if (req.method === "GET") {
    await migratePastUpcoming(store);
    const data = await readAll(store);
    return json(200, { tournaments: data });
  }

  // ---- POST: owner adds a tournament ----
  if (req.method === "POST") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    let body;
    try { body = await req.json(); }
    catch { return json(400, { error: "Invalid JSON body" }); }

    const tournament = normalizeTournament(body);
    if (!tournament) return json(400, { error: "Tournament name is required" });

    const current = await readAll(store);
    current.unshift(tournament);
    await store.setJSON(BLOB_KEY, current);
    return json(201, { tournament });
  }

  // ---- DELETE: owner removes a tournament ----
  if (req.method === "DELETE") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });

    const id = url.searchParams.get("id");
    if (!id) return json(400, { error: "id query param required" });

    const current = await readAll(store);
    const next    = current.filter((t) => t._id !== id);
    if (next.length === current.length) return json(404, { error: "Not found" });

    await store.setJSON(BLOB_KEY, next);
    return json(200, { ok: true, deletedId: id });
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/tournaments" };
