/**
 * data/account.js — a real parent account, signed in on this app.
 *
 * Made by the sign-up survey and stored in Supabase; signing in (or the
 * confirmation-email link) puts { slug, session } here. Kept in
 * sessionStorage like everything else sign-in related on this site: closing
 * the tab signs you out.
 *
 * The dashboard and College Best Fit read the golfer from the same public
 * API the golfer page uses -- /api/golfer for the generated portfolio,
 * /api/personal for the parent's own edits -- so what the dashboard scores is
 * exactly what coaches see on the page. No second copy is kept here.
 */
import { normalizeLive } from "./live.js";

const KEY = "dg.account";

/** { slug, session } or null. */
export function loadAccount() {
  try {
    const a = JSON.parse(sessionStorage.getItem(KEY));
    return a && typeof a.slug === "string" ? a : null;
  } catch {
    return null;
  }
}

export function saveAccount(slug, session) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ slug, session })); } catch { /* private mode */ }
}

/** Sign out here AND on the golfer page (they share this tab's storage). */
export function clearAccount() {
  const a = loadAccount();
  try {
    sessionStorage.removeItem(KEY);
    if (a) {
      sessionStorage.removeItem(`dg_session:${a.slug}`);
      sessionStorage.removeItem(`dg_role:${a.slug}`);
    }
  } catch { /* nothing stored */ }
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * The golfer behind an account, in the shape the dashboard and fit engine
 * read (the same shape signup.js's mockGolfer builds from survey answers).
 * Null when the page cannot be read.
 */
export async function fetchAccountGolfer(slug) {
  const get = (path) =>
    fetch(path, { headers: { "X-Golfer": slug }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [page, personal] = await Promise.all([get("/api/golfer"), get("/api/personal")]);
  if (!page) return null;

  const p = page.portfolio || {};
  const stats = p.golf?.stats || {};
  return {
    id: slug,
    slug,
    gender: p.team === "women" ? "women" : "men",
    nationalRank: num(stats["Overall JGS Rank"]),
    scoringAvg: num(stats["Scoring Average"]),
    // The parent's edits win over the generated defaults, as on the page.
    ...normalizeLive({ name: page.name, ...(p.personal || {}), ...(personal || {}) }),
  };
}
