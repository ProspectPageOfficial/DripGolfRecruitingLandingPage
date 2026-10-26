/**
 * /api/delete-account — a parent deletes their account and everything on it.
 *
 * POST { email, password }
 *
 *   200 { deleted: [slug, ...] }   account, golfer pages, saved data and
 *                                  uploaded photos/videos are gone
 *   401                            wrong email or password
 *
 * The password is asked for again even though the parent is signed in on the
 * dashboard: a tab left open on a shared computer should not be one click
 * from wiping a family's page. Checking the password itself (rather than the
 * tab's access token) also means a dashboard left open past the token's
 * hour still works. Nothing here can be undone.
 */
import { getDb } from "./_lib/db.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const db = await getDb();
  const body = (await readJson(req)) || {};
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const session = email && password ? await db.signIn(email, password) : null;
  if (!session) return json(401, { error: "That password isn't right." });

  const golfers = await db.getGolfersByOwner(session.user.id);
  try {
    await db.deleteAccount(session.user.id, golfers.map((g) => g.id));
  } catch (e) {
    console.error("delete-account failed", e);
    return json(500, { error: "Something went wrong deleting the account. Please try again." });
  }
  return json(200, { deleted: golfers.map((g) => g.slug) });
}

export const config = { path: "/api/delete-account" };
