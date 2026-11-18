/**
 * /api/resume — the owner's own wording for the downloadable resume.
 *
 * The resume is generated from the page (results, stats, bio). Any section
 * the owner rewrote in "See/Edit Resume" is saved here and used instead of
 * the generated text, for every visitor's download.
 *
 * GET    → public. The saved edits, or {} for "all automatic".
 * PUT    → owner only. Body: the full set of edits (sections left out go back
 *          to automatic). Shape:
 *            { summary?:      ["Rankings: Overall 850", ...],   // "Label: value" rows
 *              scoring?, achievements?, upcoming?, recent?: [lines],
 *              custom?: { title, lines: [...] },
 *              bio?: "text" }
 *          An empty list hides that section.
 * DELETE → owner only. Back to fully automatic.
 *
 * Storage: one JSON document per golfer (golfer_docs, key "resume").
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";

export const BLOB_KEY = "resume";
export const LIST_SECTIONS = Object.freeze(["summary", "scoring", "achievements", "upcoming", "recent"]);
const MAX_LINES = 20;
const MAX_LINE = 300;
const MAX_TITLE = 40;
const MAX_BIO = 1500;

const cleanLines = (v) =>
  Array.isArray(v)
    ? v.map((s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LINE)).filter(Boolean).slice(0, MAX_LINES)
    : null;

/** Keep only known sections, as trimmed strings within the size limits. */
export function cleanResume(body) {
  const out = {};
  if (!body || typeof body !== "object") return out;
  for (const key of LIST_SECTIONS) {
    const lines = cleanLines(body[key]);
    if (lines) out[key] = lines;
  }
  if (body.custom && typeof body.custom === "object") {
    const title = String(body.custom.title ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
    const lines = cleanLines(body.custom.lines) || [];
    if (title && lines.length) out.custom = { title, lines };
  }
  if (typeof body.bio === "string") out.bio = body.bio.trim().slice(0, MAX_BIO);
  return out;
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
    const next = cleanResume(body);
    if (Object.keys(next).length) await store.setJSON(BLOB_KEY, next);
    else await store.delete(BLOB_KEY);
    return json(200, next);
  }

  if (req.method === "DELETE") {
    if (!(await t.isOwner())) return json(401, { error: "Unauthorized" });
    await store.delete(BLOB_KEY);
    return json(200, {});
  }

  return json(405, { error: "Method not allowed" });
}

export const config = { path: "/api/resume" };
