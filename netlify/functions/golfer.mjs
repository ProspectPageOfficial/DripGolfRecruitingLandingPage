/**
 * /api/golfer — who this page belongs to, plus their generated portfolio.
 *
 * GET → public. { id, slug, name, portfolio, storage }
 *
 * `portfolio` is what Luke's page used to carry inline as PORTFOLIO_DATA:
 * scraped seasons, personal defaults and golf stats. It is written by an
 * import (tools/import-golfer.mjs) or by sign-up; the owner's own edits live
 * in the other documents (personal-overrides, tournaments, ...) and are
 * layered on top by the page exactly as before.
 *
 * `storage` hands the page the PUBLIC Supabase URL + publishable key so it
 * can upload photos and swing videos straight to Storage. Both are public by
 * design; Storage policies decide who may write where (supabase/schema.sql).
 */
import { tenant } from "./_lib/tenant.mjs";
import { json, preflight } from "./_lib/http.mjs";

export const EMPTY_PORTFOLIO = Object.freeze({
  seasons: {},
  personal: {},
  golf: { stats: {}, rankings: {}, scoring: {} },
});

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const t = await tenant(req);
  if (t.error) return t.error;
  const { golfer, store } = t;

  const saved = await store.get("portfolio");
  return json(200, {
    id: golfer.id,
    slug: golfer.slug,
    name: golfer.name,
    portfolio: { ...EMPTY_PORTFOLIO, ...(saved || {}) },
    storage: {
      url: process.env.SUPABASE_URL || null,
      key: process.env.SUPABASE_PUBLISHABLE_KEY || null,
    },
  });
}

export const config = { path: "/api/golfer" };
