/**
 * tools/gen-colleges.mjs — regenerate js/data/colleges-ncaa.js.
 *
 *   node tools/gen-colleges.mjs path/to/Most-Recent-Cohorts-Institution.csv
 *
 * Joins two public sources, then adds one modelled number:
 *
 *   1. NCAA member directory (fetched live). Every Division I, II and III school
 *      that sponsors men's golf (sport code MGO) or women's golf (WGO), with its
 *      division, conference, state, website and public/private flag.
 *   2. College Scorecard, U.S. Dept. of Education. The "Most Recent Cohorts --
 *      Institution" CSV from https://collegescorecard.ed.gov/data/ (the API's
 *      demo key allows 10 calls an hour, the bulk file has no limit). Supplies
 *      average SAT, admission rate and tuition. Joined on website domain, then
 *      on normalised name + state.
 *   3. avgRosterSeniorJgsRank -- MODELLED, not measured. There is no public
 *      source for how highly ranked each roster's players were as juniors, so
 *      it is estimated from the conference tier below. Every row says so in
 *      `rankSource`, and the UI labels it.
 *
 * Scorecard does not publish GPA, so `avgGPA` is null for every generated row
 * and the fit engine scores academics on SAT alone for these schools.
 */
import fs from "node:fs";
import readline from "node:readline";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: node tools/gen-colleges.mjs <Most-Recent-Cohorts-Institution.csv>");
  process.exit(1);
}

const NCAA = "https://web3.ncaa.org/directory/api/directory/memberList?type=12&sportCode=";
const OUT = new URL("../js/data/colleges-ncaa.js", import.meta.url);

// ---------------------------------------------------------------------------
// The modelled number. Estimated average end-of-senior-year JGS rank of a
// roster's players, by conference. Lower = tougher. Anchored loosely on the
// hand-set rows in colleges.js (Power-conference D1 ~50-150, D3 UAA ~600-800).
// ---------------------------------------------------------------------------
const TIER_RANK = { d1a: 120, d1b: 350, d1c: 700, d1d: 2200, d2a: 700, d2b: 1400, d3a: 1100, d3b: 2600 };

const CONFERENCE_TIER = {
  "Southeastern Conference": "d1a", "Atlantic Coast Conference": "d1a",
  "Big 12 Conference": "d1a", "Big Ten Conference": "d1a", "Pac-12 Conference": "d1a",

  "American Conference": "d1b", "Mountain West Conference": "d1b", "West Coast Conference": "d1b",
  "Sun Belt Conference": "d1b", "Conference USA": "d1b", "Mid-American Conference": "d1b",
  "Missouri Valley Conference": "d1b", "Southern Conference": "d1b", "BIG EAST Conference": "d1b",
  "Coastal Athletic Association": "d1b", "Big West Conference": "d1b", "Atlantic 10 Conference": "d1b",

  "Southwestern Athletic Conf.": "d1d", "Mid-Eastern Athletic Conf.": "d1d",

  "Sunshine State Conference": "d2a", "Gulf South Conference": "d2a", "Peach Belt Conference": "d2a",
  "South Atlantic Conference": "d2a", "Lone Star Conference": "d2a", "Rocky Mountain Athletic Conference": "d2a",
  "California Collegiate Athletic Association": "d2a", "Mid-America Intercollegiate Athletics Association": "d2a",
  "Great Lakes Valley Conference": "d2a", "Conference Carolinas": "d2a",

  "University Athletic Association": "d3a", "New England Small College Athletic Conference": "d3a",
  "Southern Collegiate Athletic Conference": "d3a", "Southern California Intercollegiate Athletic Conf.": "d3a",
  "USA South Athletic Conference": "d3a", "Old Dominion Athletic Conf.": "d3a",
  "Centennial Conference": "d3a", "Liberty League": "d3a", "Ohio Athletic Conference": "d3a",
};
const DEFAULT_TIER = { 1: "d1c", 2: "d2b", 3: "d3b" };

// U.S. Census-style regions, folded into the five the app already uses.
const REGION = {
  West: "WA OR CA NV ID MT WY UT CO AK HI",
  Southwest: "AZ NM TX OK",
  Midwest: "ND SD NE KS MN IA MO WI IL IN MI OH",
  Southeast: "AR LA MS AL TN KY GA FL SC NC VA WV DC",
  Northeast: "MD DE PA NJ NY CT RI MA VT NH ME",
};
const regionFor = (st) => Object.keys(REGION).find((r) => REGION[r].split(" ").includes(st)) ?? null;

const DIVISION = { 1: "D1", 2: "D2", 3: "D3" };

/** "https://www.Stanford.edu/about" -> "stanford.edu" */
const host = (url) =>
  String(url || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\s;,/?#]/)[0];

const normName = (s) =>
  String(s).toLowerCase().replace(/&/g, "and").replace(/^the /, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Short readable conference names. The directory's are verbose and inconsistent. */
const shortConf = (c) =>
  c.trim()
    .replace(/^The /, "")
    .replace(/ Athletic Conf\.$| Conf\.$/, "")
    .replace(/ (Athletic )?Conference$/, "")
    .replace(/^Southern Intercol\. Ath\./, "SIAC")
    .replace(/Southern California Intercollegiate Athletic/, "SCIAC")
    .replace(/Mid-America Intercollegiate Athletics Association/, "MIAA")
    .replace(/California Collegiate Athletic Association/, "CCAA");

const slug = (s) => normName(s).replace(/ /g, "-");

/** Minimal CSV line splitter: handles quoted fields with embedded commas. */
function splitCsv(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function readScorecard(path) {
  const rl = readline.createInterface({ input: fs.createReadStream(path) });
  let cols = null;
  const byHost = new Map(), byName = new Map();
  for await (const line of rl) {
    const f = splitCsv(line);
    if (!cols) { cols = Object.fromEntries(f.map((c, i) => [c.replace(/^﻿/, ""), i])); continue; }
    const get = (k) => f[cols[k]];
    const num = (k) => { const v = Number(get(k)); return get(k) === "NULL" || get(k) === "" || !Number.isFinite(v) ? null : v; };
    const row = {
      unitid: get("UNITID"), name: get("INSTNM"), state: get("STABBR"), host: host(get("INSTURL")),
      control: num("CONTROL"), sat: num("SAT_AVG"), admit: num("ADM_RATE"),
      tuitionIn: num("TUITIONFEE_IN"), tuitionOut: num("TUITIONFEE_OUT"), size: num("UGDS"),
      operating: get("CURROPER") === "1",
    };
    if (!row.operating) continue;
    // Several campuses can share one domain; keep the biggest (the main campus).
    if (row.host && (!byHost.has(row.host) || (row.size ?? 0) > (byHost.get(row.host).size ?? 0))) byHost.set(row.host, row);
    byName.set(`${normName(row.name)}|${row.state}`, row);
  }
  return { byHost, byName };
}

async function ncaa(code) {
  const res = await fetch(NCAA + code, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`NCAA ${code}: HTTP ${res.status}`);
  return res.json();
}

const [men, women, scorecard] = await Promise.all([ncaa("MGO"), ncaa("WGO"), readScorecard(csvPath)]);

const schools = new Map();
for (const [list, team] of [[men, "men"], [women, "women"]]) {
  for (const m of list) {
    if (m.deactive === "Y" || !DIVISION[m.division]) continue;
    const s = schools.get(m.orgId) ?? { m, programs: { men: false, women: false } };
    s.programs[team] = true;
    schools.set(m.orgId, s);
  }
}

let matched = 0;
const rows = [];
for (const { m, programs } of schools.values()) {
  const state = m.memberOrgAddress?.state ?? null;
  const ncaaDomain = host(m.webSiteUrl) || host(m.athleticWebUrl);
  const sc =
    scorecard.byHost.get(ncaaDomain) ??
    scorecard.byName.get(`${normName(m.nameOfficial)}|${state}`) ??
    null;
  const domain = ncaaDomain || sc?.host;
  if (sc) matched++;

  const conference = m.conferenceName.trim();
  const tier = CONFERENCE_TIER[conference] ?? DEFAULT_TIER[m.division];
  const isPublic = sc ? sc.control === 1 : m.privateFlag === "N";

  rows.push({
    id: `ncaa-${m.orgId}`,
    ncaaId: m.orgId,
    domain: domain || null,
    name: m.nameOfficial.trim(),
    division: DIVISION[m.division],
    conference: shortConf(conference),
    region: regionFor(state),
    state,
    type: isPublic ? "Public" : "Private",
    programs,
    avgRosterSeniorJgsRank: TIER_RANK[tier],
    rankSource: "conference-estimate",
    avgGPA: null,
    avgSAT: sc?.sat ?? null,
    acceptRate: sc?.admit != null ? Math.round(sc.admit * 100) : null,
    // Sticker price a recruit from out of state would see. Private schools
    // charge one rate, so in == out for them.
    tuition: sc?.tuitionOut ?? sc?.tuitionIn ?? null,
    scorecardId: sc?.unitid ?? null,
  });
}

rows.sort((a, b) => a.division.localeCompare(b.division) || a.name.localeCompare(b.name));

const today = new Date().toISOString().slice(0, 10);
const body = `/**
 * data/colleges-ncaa.js — GENERATED by tools/gen-colleges.mjs on ${today}. Do not hand-edit.
 *
 * ${rows.length} NCAA Division I-III schools that sponsor men's or women's golf.
 *   REAL:      name, division, conference, state, website, public/private,
 *              programs (NCAA member directory); avgSAT, acceptRate, tuition
 *              (College Scorecard, U.S. Dept. of Education). ${matched} of ${rows.length}
 *              rows matched a Scorecard record; the rest carry nulls.
 *   MODELLED:  avgRosterSeniorJgsRank, estimated from conference tier
 *              (rankSource: "conference-estimate"). Not a measurement.
 *   ABSENT:    avgGPA -- Scorecard does not publish it.
 */
export const NCAA_GOLF_PROGRAMS = ${JSON.stringify(rows)};
`;
fs.writeFileSync(OUT, body.replace(/\},\{/g, "},\n{"));
console.log(`${rows.length} programs (${matched} matched to Scorecard) -> ${OUT.pathname}`);
