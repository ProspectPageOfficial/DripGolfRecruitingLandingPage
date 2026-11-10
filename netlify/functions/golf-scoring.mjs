/**
 * /api/golf-scoring — the Golf Bio "Scoring Profile" and "Scoring Types".
 *
 * Two ways to fill them, so the page works for every family:
 *   - Drip Golf Tour members link their tour profile (`tourPlayerId`). The
 *     page then reads the stats from the tour through /api/drip-golf, so they
 *     update after every event with nothing to type.
 *   - Everyone else types them in (`manual`). A linked tour profile's stats
 *     are shown instead of these whenever the tour has any.
 *
 * GET → public. { tourPlayerId?, manual? }
 * PUT → owner only. Body: any of
 *         tourPlayerId: a tour player ID, a link to the tour profile, or "" to unlink
 *         manual: { "Par 3's": "3.25", Birdies: "12", ... }, "" drops a value
 *
 * Storage: one JSON document per golfer (golfer_docs, key "golf-scoring").
 * /api/golfer layers it onto the portfolio. Owner auth: same Supabase token
 * check as every other function (_lib/tenant.mjs).
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";
import { SCORING_PAR_FIELDS, SCORING_TYPE_FIELDS } from "../../js/data/dripgolf.js";

export const BLOB_KEY = "golf-scoring";

/** "https://www.dripgolftour.com/...PlayerID=256648&..." or "256648" -> "256648"; "" -> null. */
export function cleanTourId(input) {
  const s = String(input ?? "").trim();
  if (!s) return { value: null };
  const id = /PlayerID=(\d{1,9})\b/i.exec(s)?.[1] ?? (/^\d{1,9}$/.test(s) ? s : null);
  if (!id) return { error: "Paste the link to your Drip Golf Tour player profile, or its player ID number." };
  return { value: id };
}

/** Per-hole averages are like 3.25; scoring types are whole-number counts. */
export function cleanScoring(input) {
  if (!input || typeof input !== "object") return { error: "Invalid scoring stats." };
  const out = {};
  for (const field of SCORING_PAR_FIELDS) {
    const s = String(input[field] ?? "").trim();
    if (!s) continue;
    if (!/^\d(\.\d{1,2})?$/.test(s) || Number(s) < 1) {
      return { error: `${field.replace("'s", "")} average must be a number like 3.25.` };
    }
    out[field] = s;
  }
  for (const field of SCORING_TYPE_FIELDS) {
    const s = String(input[field] ?? "").trim().replace(/,/g, "");
    if (!s) continue;
    if (!/^\d{1,5}$/.test(s)) return { error: `${field} must be a whole number, like 12.` };
    out[field] = String(Number(s));
  }
  return { value: out };
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

    const next = { ...((await store.get(BLOB_KEY)) || {}) };
    if ("tourPlayerId" in body) {
      const { value, error } = cleanTourId(body.tourPlayerId);
      if (error) return json(400, { error });
      if (value) next.tourPlayerId = value;
      else delete next.tourPlayerId;
    }
    if ("manual" in body) {
      const { value, error } = cleanScoring(body.manual);
      if (error) return json(400, { error });
      if (Object.keys(value).length) next.manual = value;
      else delete next.manual;
    }
    await store.setJSON(BLOB_KEY, next);
    return json(200, next);
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/golf-scoring" };
