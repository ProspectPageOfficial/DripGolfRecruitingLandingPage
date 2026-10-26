/**
 * Move an existing single-golfer site onto Drip Golf Pages.
 *
 *   OWNER_PASSWORD='...' node tools/import-golfer.mjs \
 *     --name "Luke Thomas Selzer" --slug luke-thomas-selzer \
 *     --owner-email family@example.com \
 *     --html ../LukeThomasSelzer.com/ltselzer-portfolio.html \
 *     --live https://lukethomasselzer.com \
 *     [--domain lukethomasselzer.com] [--bio "Default bio text"]
 *
 * What it copies:
 *   --html   the PORTFOLIO_DATA results pasted into the old page
 *   --live   the owner's saved edits, read from the old site's PUBLIC GET
 *            endpoints (bio, tournaments, swing videos, featured swing,
 *            theme, upcoming). Read-only: the old site is not changed.
 *
 * The owner account is created with OWNER_PASSWORD (an env var, so it is not
 * left in shell history as an argument). If the email already has an
 * account, the same password signs in to it instead.
 *
 * Writes to Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
 * otherwise to the local dev backend. Re-running updates the documents.
 *
 * --domain is left off until the domain's DNS actually points at this site:
 * setting it early is harmless here, but leaving it off keeps "which address
 * serves which golfer" matching reality.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { getDb } from "../netlify/functions/_lib/db.mjs";

const DOC_ENDPOINTS = {
  "personal-overrides": ["personal", (d) => d],
  tournaments: ["tournaments", (d) => d.tournaments],
  "swing-videos": ["swing-videos", (d) => d.videos],
  "featured-swing": ["featured-swing", (d) => (d && d.videoUrl ? d : null)],
  theme: ["theme", (d) => d],
  "upcoming-tournaments": ["upcoming-tournaments", (d) => d.upcoming],
};

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  }
  return out;
}

/** The `const PORTFOLIO_DATA = {...};` literal from an old page. It is JSON. */
export function portfolioFromHtml(html) {
  const m = /const PORTFOLIO_DATA = (\{[\s\S]*?\n\});/.exec(html);
  if (!m) throw new Error("No PORTFOLIO_DATA found in that file");
  return JSON.parse(m[1]);
}

async function main() {
  const a = args(process.argv.slice(2));
  const password = process.env.OWNER_PASSWORD;
  for (const k of ["name", "slug", "owner-email"]) if (!a[k]) throw new Error(`--${k} is required`);
  if (!password || password.length < 8) throw new Error("Set OWNER_PASSWORD (8+ characters) in the environment");

  if (!process.env.SUPABASE_URL) {
    process.env.DRIP_DEV = "1";
    console.log("No SUPABASE_URL set: writing to the LOCAL dev data (.dev-data/), not Supabase.");
  }
  const db = await getDb();

  let owner = await db.signUp(a["owner-email"], password);
  if (owner.error) {
    const session = await db.signIn(a["owner-email"], password);
    if (!session) throw new Error(`Couldn't create or sign in to ${a["owner-email"]}: ${owner.error}`);
    owner = { user: session.user };
  }

  let golfer = await db.getGolferBySlug(a.slug);
  if (!golfer) {
    golfer = await db.createGolfer({ ownerId: owner.user.id, slug: a.slug, name: a.name, domain: a.domain || null });
    console.log(`Created ${a.name} at /${a.slug}`);
  } else if (golfer.owner_id !== owner.user.id) {
    throw new Error(`/${a.slug} already belongs to a different account`);
  } else {
    console.log(`Updating ${a.name} at /${a.slug}`);
  }

  if (a.html) {
    const portfolio = portfolioFromHtml(readFileSync(a.html, "utf8"));
    if (a.bio && !portfolio.personal.bio) portfolio.personal.bio = a.bio;
    await db.setDoc(golfer.id, "portfolio", portfolio);
    const events = Object.values(portfolio.seasons).reduce((n, s) => n + s.length, 0);
    console.log(`  portfolio: ${events} tournaments across ${Object.keys(portfolio.seasons).length} seasons`);
  }

  if (a.live) {
    for (const [key, [path, pick]] of Object.entries(DOC_ENDPOINTS)) {
      const res = await fetch(new URL(`/api/${path}`, a.live), { headers: { Accept: "application/json" } });
      if (!res.ok) { console.warn(`  ${key}: skipped (HTTP ${res.status})`); continue; }
      const value = pick(await res.json());
      const empty = value == null || (Array.isArray(value) ? !value.length : !Object.keys(value).length);
      if (empty) { console.log(`  ${key}: nothing saved`); continue; }
      await db.setDoc(golfer.id, key, value);
      console.log(`  ${key}: copied`);
    }
  }
  console.log("Done.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
