/**
 * Which golfer is this request about, and is the caller that golfer's owner?
 *
 * The golfer comes from, in order:
 *   1. the X-Golfer header -- the page sends its slug when it is served from
 *      the shared host (pages.example.com/ava-reed)
 *   2. the request's host  -- a golfer's own domain (avareed.com)
 *
 * Reads are public: a coach never signs in. Writes need a Supabase access
 * token whose user is the golfer's owner_id. Picking a golfer via X-Golfer
 * grants nothing -- it only says which page you are LOOKING at, and owning
 * that page is still checked against the token.
 */
import { getDb, golferStore } from "./db.mjs";
import { json } from "./http.mjs";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/** "WWW.AvaReed.com:443" -> "avareed.com" */
export function hostOf(req) {
  const raw = req.headers.get("x-forwarded-host") || new URL(req.url).host;
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

export function bearer(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  return m ? m[1].trim() : null;
}

export async function tenant(req) {
  const db = await getDb();
  const slug = (req.headers.get("x-golfer") || "").trim().toLowerCase();

  let golfer = null;
  if (slug) golfer = SLUG_RE.test(slug) ? await db.getGolferBySlug(slug) : null;
  else golfer = await db.getGolferByDomain(hostOf(req));

  if (!golfer) return { error: json(404, { error: "No golfer page here" }) };

  let ownerCheck;
  const isOwner = () =>
    (ownerCheck ??= (async () => {
      const token = bearer(req);
      if (!token) return false;
      const user = await db.userFromToken(token);
      return !!user && user.id === golfer.owner_id;
    })());

  return { db, golfer, store: golferStore(db, golfer.id), isOwner };
}
