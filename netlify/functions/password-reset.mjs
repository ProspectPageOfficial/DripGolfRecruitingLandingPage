/**
 * /api/password-reset — "Forgot password?"
 *
 * POST { email }
 *   -> 200 { ok: true } whether or not that email has an account, so this
 *      can't be used to find out who has signed up.
 *   -> 429 when the email service's rate limit is hit.
 *
 * The emailed link brings the parent back to this site's homepage with a
 * recovery session in the URL fragment; js/main.js sends them on to
 * #/reset-password, which saves the new password through /api/password-update.
 */
import { getDb } from "./_lib/db.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = (await readJson(req)) || {};
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: "Enter a valid email address." });

  // Back to the homepage of whichever address they asked from.
  const redirectTo = `${new URL(req.url).origin}/`;
  const db = await getDb();
  const result = await db.sendPasswordReset(email, redirectTo);
  if (result.error === "rate-limited") {
    return json(429, { error: "Too many reset emails just now. Please wait a few minutes and try again." });
  }
  return json(200, { ok: true });
}

export const config = { path: "/api/password-reset" };
