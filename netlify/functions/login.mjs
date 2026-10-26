/**
 * /api/login — sign the owner in to THIS golfer's page.
 *
 * POST { email, password }   -> 200 { session } | 401 | 403
 * POST { refresh_token }     -> 200 { session } | 401
 *
 * Replaces /api/auth's single shared password. A correct email + password
 * for an account that does not own this page is a 403, and no session is
 * handed back: signing in to Ava's page with Luke's account gets you nothing
 * to hold on to.
 *
 * Going through the server (rather than supabase-js in the page) keeps the
 * page free of auth logic and lets the dev backend stand in for Supabase.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const t = await tenant(req);
  if (t.error) return t.error;
  const { db, golfer } = t;

  const body = (await readJson(req)) || {};
  let session = null;
  if (typeof body.refresh_token === "string" && body.refresh_token) {
    session = await db.refresh(body.refresh_token);
  } else if (typeof body.email === "string" && typeof body.password === "string") {
    session = await db.signIn(body.email.trim(), body.password);
  } else {
    return json(400, { error: "Email and password are required" });
  }

  if (!session) return json(401, { error: "Wrong email or password." });
  if (session.user.id !== golfer.owner_id) {
    return json(403, { error: "That account doesn't own this page." });
  }
  return json(200, { session });
}

export const config = { path: "/api/login" };
