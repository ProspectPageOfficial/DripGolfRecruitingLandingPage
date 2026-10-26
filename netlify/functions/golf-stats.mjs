/**
 * /api/golf-stats — the owner's own rankings: JGS, TUGR, CGA, Drip Golf.
 *
 * GET  → public. The owner's saved values, e.g. { "Overall JGS Rank": "850" }.
 * PUT  → owner only. Body: any of the four keys. A value is a rank number
 *        ("#1,234" is cleaned to "1234"), "N/A", or "" to drop the owner's
 *        value and fall back to the imported one.
 *
 * Rankings move every few weeks, and the imported/sign-up values never
 * would. /api/golfer layers these over the portfolio's golf.stats, so the
 * page, the resume PDF, the dashboard and College Best Fit (which scores on
 * "Overall JGS Rank") all follow an edit here.
 *
 * Storage: one JSON document per golfer in Supabase (golfer_docs table,
 * key "golf-stats"), reached through _lib/tenant.mjs.
 *
 * Owner auth: a Supabase access token in `Authorization: Bearer <token>`,
 * whose user must own this golfer. Same check in every function.
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export const BLOB_KEY = "golf-stats";

/** The page's own labels, so the values drop straight into golf.stats. */
export const RANK_FIELDS = Object.freeze(["Overall JGS Rank", "TUGR Rank", "CGA Rank", "Drip Golf Rank"]);

/**
 * "#1,234" -> "1234"; "n/a" -> "N/A"; "" -> null (clear). Anything else is
 * an error: a rank is a whole number, and College Best Fit does arithmetic
 * on the JGS one.
 */
export function cleanRank(input) {
  const s = String(input ?? "").trim();
  if (!s) return { value: null };
  if (/^n\/?a$/i.test(s)) return { value: "N/A" };
  const digits = s.replace(/^#/, "").replace(/[,\s]/g, "");
  if (!/^\d{1,6}$/.test(digits) || Number(digits) < 1) return { error: "Ranks must be a whole number (like 850), N/A, or left blank." };
  return { value: String(Number(digits)) };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();

  const t = await tenant(req);
  if (t.error) return t.error;
  const { store } = t;

  if (req.method === "GET") {
    const saved = await store.get(BLOB_KEY);
    return json(200, saved && typeof saved === "object" ? saved : {});
  }

  if (req.method === "PUT") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });
    const body = await readJson(req);
    if (!body || typeof body !== "object") return json(400, { error: "Invalid JSON body" });

    const current = (await store.get(BLOB_KEY)) || {};
    const next = { ...current };
    for (const field of RANK_FIELDS) {
      if (!(field in body)) continue;
      const { value, error } = cleanRank(body[field]);
      if (error) return json(400, { error: `${field}: ${error}` });
      if (value == null) delete next[field];
      else next[field] = value;
    }
    await store.setJSON(BLOB_KEY, next);
    return json(200, next);
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/golf-stats" };
