/**
 * tools/gen-rosters.mjs — regenerate js/data/rosters-ncaa.js.
 *
 *   node tools/gen-rosters.mjs            # cached pages reused
 *   node tools/gen-rosters.mjs --refresh  # re-download every page
 *
 * Reads each golf team's roster off the school's own athletics site (the
 * same sites tools/gen-coaches.mjs reads) and keeps only HOW MANY players are
 * in each class year. No names: the app needs "how many spots open up before
 * this golfer arrives", not who the players are.
 *
 * Two SIDEARM layouts cover most programs:
 *   - current sites: players in <script id="__NUXT_DATA__"> with
 *     academicYearNumber / academicYearShort
 *   - older sites: <li class="sidearm-roster-player"> with a
 *     .sidearm-roster-player-academic-year label ("Fr.", "R-Sr.", "Gr.")
 * A team whose roster cannot be read simply shows no roster line.
 *
 * Rosters change every August: re-run at the start of each season, after
 * gen-coaches.mjs.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { NCAA_GOLF_PROGRAMS } from "../js/data/colleges-ncaa.js";
import { getPage, pool, DIRECTORY, UA } from "./gen-coaches.mjs";

const OUT = new URL("../js/data/rosters-ncaa.js", import.meta.url);
const PATHS = {
  men: ["/sports/mens-golf/roster", "/sports/mgolf/roster", "/sports/golf/roster"],
  women: ["/sports/womens-golf/roster", "/sports/wgolf/roster", "/sports/golf/roster"],
};

/**
 * "Fr.", "R-So.", "Junior", "Gr.", "5th", "Graduate Student" -> 1..5.
 * 5 is a graduate / fifth-year player: in their final season. Unknown -> null.
 */
export function classYear(label) {
  const s = String(label || "").toLowerCase().replace(/^r(edshirt)?[- ]?/, "").trim();
  if (/^(fr|freshman|first)/.test(s)) return 1;
  if (/^(so|soph|sophomore|second)/.test(s)) return 2;
  if (/^(jr|junior|third)/.test(s)) return 3;
  if (/^(sr|senior|fourth)/.test(s)) return 4;
  if (/^(gr|grad|5th|fifth|super)/.test(s)) return 5;
  return null;
}

/** Current SIDEARM: class years of every player in the embedded data. */
export function parseNuxtRoster(html) {
  const m = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  let raw;
  try { raw = JSON.parse(m[1]); } catch { return []; }
  const val = (i) => (typeof i === "number" ? raw[i] : i);
  const out = [];
  const seen = new Set();
  for (const v of raw) {
    if (!v || typeof v !== "object" || Array.isArray(v) || !("firstName" in v) || !("academicYearShort" in v)) continue;
    const id = val(v.rosterPlayerId) ?? val(v.playerId) ?? `${val(v.firstName)} ${val(v.lastName)}`;
    if (seen.has(id) || val(v.hide) === true) continue;
    seen.add(id);
    const n = Number(val(v.academicYearNumber));
    out.push(Number.isInteger(n) && n >= 1 && n <= 5 ? n : classYear(val(v.academicYearShort) || val(v.academicYearLong)));
  }
  return out;
}

/** Older SIDEARM: one <li class="sidearm-roster-player"> per player. */
export function parseSidearmRoster(html) {
  const parts = html.split(/<li class="sidearm-roster-player[" ]/).slice(1);
  return parts.map((p) => classYear(/sidearm-roster-player-academic-year[^>]*>\s*([^<]+)</.exec(p)?.[1]));
}

/**
 * Turn class years into counts. Null when nothing could be read -- a roster
 * of unknowns is not information.
 */
export function summarize(years) {
  const known = years.filter((y) => y != null);
  if (known.length < 3) return null; // a staff list or a stub page, not a roster
  const byYear = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const y of known) byYear[y] += 1;
  return { size: years.length, byYear };
}

async function rosterFor(site, team) {
  for (const p of PATHS[team]) {
    const page = await getPage(`https://${site}${p}`);
    if (!page) continue;
    const years = parseNuxtRoster(page.html);
    const summary = summarize(years.length ? years : parseSidearmRoster(page.html));
    if (summary) return { ...summary, source: page.url };
  }
  return null;
}

/** "2026-27" in the fall, the same until next August. */
export function seasonFor(date = new Date()) {
  const y = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(2)}`;
}

async function main() {
  const sites = new Map();
  for (const code of ["MGO", "WGO"]) {
    const res = await fetch(DIRECTORY + code, { headers: { "User-Agent": UA } });
    for (const m of await res.json()) {
      const host = String(m.athleticWebUrl || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
      if (host) sites.set(m.orgId, host);
    }
  }
  const jobs = [];
  for (const p of NCAA_GOLF_PROGRAMS) {
    for (const team of ["men", "women"]) if (p.programs?.[team] && sites.get(p.ncaaId)) jobs.push({ p, team, site: sites.get(p.ncaaId) });
  }
  console.log(`${jobs.length} rosters to read`);

  const found = {};
  await pool(jobs, 8, async ({ p, team, site }) => {
    const r = await rosterFor(site, team);
    if (r) (found[p.ncaaId] ??= {})[team] = r;
  });

  const teams = Object.values(found).reduce((n, t) => n + Object.keys(t).length, 0);
  const sorted = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a - b));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(OUT, `/**
 * data/rosters-ncaa.js — GENERATED by tools/gen-rosters.mjs on ${today}. Do not hand-edit.
 *
 * How many players each golf team has in each class year (1 = freshman ...
 * 4 = senior, 5 = graduate / fifth year), read off the school's own roster
 * page (source URL per entry), for the ${seasonFor()} season. Counts only, no
 * names. ${teams} of ${jobs.length} teams read. Keyed by NCAA org id, then team.
 */
export const ROSTER_SEASON = "${seasonFor()}";

export const NCAA_ROSTERS = ${JSON.stringify(sorted)};
`);
  console.log(`Read ${teams} of ${jobs.length} rosters.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
