/**
 * /api/my-page — "which golfer page is mine?" for a parent signing in from
 * the homepage rather than from their golfer's page.
 *
 * POST { email, password }                    -> sign in, then find the page
 * POST { refresh_token } + Authorization      -> the confirmation-email link:
 *      Bearer <access_token>                     the tokens Supabase put in the
 *                                                link become a session
 *
 *   200 { slug, session }   the golfer page this account owns
 *   401                     wrong email / password, or not yet confirmed
 *   404                     signed in, but no golfer page on this account
 *
 * /api/login stays the per-page sign-in (it needs to know the golfer up
 * front); this one starts from the account and works the golfer out.
 */
import { getDb } from "./_lib/db.mjs";
import { bearer } from "./_lib/tenant.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const db = await getDb();
  const body = (await readJson(req)) || {};

  let session = null;
  if (typeof body.email === "string" && typeof body.password === "string") {
    session = await db.signIn(body.email.trim(), body.password);
    if (!session) {
      return json(401, { error: "Wrong email or password. If you just signed up, confirm your email first." });
    }
  } else {
    const token = bearer(req);
    const user = token ? await db.userFromToken(token) : null;
    if (!user) return json(401, { error: "That sign-in link has expired. Sign in with your email and password." });
    session = { access_token: token, refresh_token: String(body.refresh_token || ""), expires_at: body.expires_at || null, user };
  }

  const golfers = await db.getGolfersByOwner(session.user.id);
  if (!golfers.length) return json(404, { error: "There's no golfer page on this account yet." });
  // One golfer per family today; the oldest page wins if that ever changes.
  return json(200, { slug: golfers[0].slug, session });
}

export const config = { path: "/api/my-page" };
