/**
 * /api/password-update — set a new password from a reset link.
 *
 * POST { password }  with  Authorization: Bearer <access token from the link>
 *   -> 200 { ok: true }
 *   -> 400 password too short
 *   -> 401 link expired or not valid (ask for a new one)
 *
 * The token is the recovery session Supabase put in the reset link, so only
 * someone who opened that email can use it.
 */
import { getDb } from "./_lib/db.mjs";
import { bearer } from "./_lib/tenant.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = (await readJson(req)) || {};
  const password = String(body.password || "");
  if (password.length < 8) return json(400, { error: "Password must be at least 8 characters." });

  const db = await getDb();
  const token = bearer(req);
  const user = token ? await db.userFromToken(token) : null;
  if (!user) {
    return json(401, { error: "This reset link has expired or was already used. Request a new one." });
  }
  const result = await db.setPassword(user.id, password);
  if (result.error) return json(500, { error: "Couldn't save the new password. Please try again." });
  return json(200, { ok: true });
}

export const config = { path: "/api/password-update" };
