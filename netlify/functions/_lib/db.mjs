/**
 * The data layer every function goes through. Two interchangeable backends:
 *
 *   Supabase (production)  -- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
 *   Local file (dev only)  -- DRIP_DEV=1, see db-dev.mjs
 *
 * Production never falls back to the file store: a deploy with missing env
 * vars must fail loudly, not quietly write golfers' data to a disk that
 * Netlify throws away after the request.
 *
 * Interface (both adapters implement exactly this):
 *   getGolferBySlug(slug) / getGolferByDomain(host)   -> golfer | null
 *   getGolfersByOwner(userId)                          -> golfer[] (oldest first)
 *   slugTaken(slug)                                    -> boolean
 *   createGolfer({ ownerId, slug, name, domain })      -> golfer
 *   getDoc(golferId, key) / setDoc(...) / deleteDoc(...)
 *   signUp(email, password)        -> { user, session } | { error }
 *   signIn(email, password)        -> session | null
 *   refresh(refreshToken)          -> session | null
 *   userFromToken(accessToken)     -> { id, email } | null
 *
 * A golfer is { id, owner_id, slug, name, domain }. A session is
 * { access_token, refresh_token, expires_at, user: { id, email } }.
 */
let cached;

export async function getDb() {
  if (cached) return cached;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseDb } = await import("./db-supabase.mjs");
    cached = supabaseDb();
  } else if (process.env.DRIP_DEV === "1") {
    const { devDb } = await import("./db-dev.mjs");
    cached = devDb();
  } else {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or DRIP_DEV=1 for local testing).");
  }
  return cached;
}

/** For tests: swap in a backend without touching env vars. */
export function setDbForTests(db) {
  cached = db;
}

/**
 * The same get / setJSON / delete shape as a Netlify Blobs store, scoped to
 * one golfer. The original single-golfer functions were written against
 * Blobs, so handing them this keeps their logic unchanged: only WHICH
 * golfer's data they touch is new.
 */
export function golferStore(db, golferId) {
  return {
    get: (key) => db.getDoc(golferId, key),
    setJSON: (key, value) => db.setDoc(golferId, key, value),
    delete: (key) => db.deleteDoc(golferId, key),
  };
}
