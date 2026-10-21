/**
 * tools/gen-coaches.mjs — regenerate js/data/coaches-ncaa.js.
 *
 *   node tools/gen-coaches.mjs            # every program, cached pages reused
 *   node tools/gen-coaches.mjs --refresh  # re-download every page
 *
 * For every school in colleges-ncaa.js, reads the head golf coach (men's and
 * women's, whichever the school fields) off the school's OWN athletics site:
 * the "Coaches" page the NCAA member directory links to. Name, title, email,
 * phone and headshot are taken exactly as the school publishes them; nothing
 * is guessed. A school whose page cannot be read is listed in the report and
 * simply has no coach card ("Contact not on file yet").
 *
 * Two page layouts cover most of college athletics, both from SIDEARM Sports:
 *   - current sites embed the staff list as JSON (<script id="__NUXT_DATA__">)
 *   - older sites render a <tr class="sidearm-coaches-coach"> table
 * PrestoSports (common in D2/D3) is read from its staff table as a fallback.
 *
 * Pages are cached in tools/.cache/coaches/ so the parser can be improved and
 * re-run without hitting ~900 athletics sites again. Requests run a few at a
 * time with a browser-like User-Agent; these are public staff directories.
 *
 * Coach turnover is ~10-15% a year: re-run before each fall season.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { NCAA_GOLF_PROGRAMS } from "../js/data/colleges-ncaa.js";

const OUT = new URL("../js/data/coaches-ncaa.js", import.meta.url);
const CACHE = new URL("./.cache/coaches/", import.meta.url);
const DIRECTORY = "https://web3.ncaa.org/directory/api/directory/memberList?type=12&sportCode=";
const REFRESH = process.argv.includes("--refresh");
const CONCURRENCY = 8;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/** Where each platform keeps a team's coaches page, most common first. */
const PATHS = {
  men: ["/sports/mens-golf/coaches", "/sports/mgolf/coaches", "/sports/mgolf/coaches/index", "/sports/m-golf/coaches/index", "/sports/golf/coaches"],
  women: ["/sports/womens-golf/coaches", "/sports/wgolf/coaches", "/sports/wgolf/coaches/index", "/sports/w-golf/coaches/index", "/sports/golf/coaches"],
};

// ---------------------------------------------------------------------------
// Parsing (exported for tests)
// ---------------------------------------------------------------------------

const decode = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&rsquo;|&lsquo;/g, "’").replace(/&ndash;|&mdash;/g, "-")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const absolute = (url, base) => {
  if (!url) return null;
  try { return new URL(url, base).href; } catch { return null; }
};

/** Current SIDEARM: Nuxt's flattened JSON, where values are indexes into one array. */
export function parseNuxt(html, base) {
  const m = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  let raw;
  try { raw = JSON.parse(m[1]); } catch { return []; }
  const at = (i, depth = 0) => {
    const v = raw[i];
    if (depth > 4 || v == null || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      if (typeof v[0] === "string" && /^(Shallow)?(Reactive|Ref)$/.test(v[0])) return at(v[1], depth + 1);
      return v;
    }
    const o = {};
    for (const k of Object.keys(v)) o[k] = typeof v[k] === "number" ? at(v[k], depth + 1) : v[k];
    return o;
  };
  const out = [];
  raw.forEach((v, i) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || !("firstName" in v) || !("title" in v)) return;
    const r = at(i);
    const name = decode(`${r.firstName ?? ""} ${r.lastName ?? ""}`);
    if (!name) return;
    out.push({
      name,
      title: decode(r.title),
      email: typeof r.email === "string" ? r.email.trim() : null,
      phone: typeof r.phone === "string" ? r.phone.trim() : null,
      photo: absolute(r.image?.absoluteUrl || r.image?.url, base),
      gender: r.sport?.globalSportGender || null, // "m" | "f"
    });
  });
  return out;
}

/** Older SIDEARM: one <tr class="sidearm-coaches-coach"> per person. */
export function parseSidearmTable(html, base) {
  return [...html.matchAll(/<tr class="sidearm-coaches-coach[^"]*">([\s\S]*?)<\/tr>/g)].map(([, row]) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1]);
    const name = decode(/<a[^>]*>([\s\S]*?)<\/a>/.exec(row)?.[1] || /alt=['"]([^'"]+)['"]/.exec(row)?.[1]);
    const title = cells.map(decode).find((t) => t && t !== name && /coach|director|golf/i.test(t)) || "";
    const img = /<img[^>]*src=['"]([^'"]+)['"]/.exec(row)?.[1];
    return {
      name,
      title,
      email: /mailto:([^'"?]+)/.exec(row)?.[1]?.trim() || null,
      phone: decode(/href=['"]tel:([^'"]+)['"]/.exec(row)?.[1]) || null,
      photo: absolute(img, base),
      bio: absolute(/href=['"]([^'"]*\/(?:roster\/coaches|staff-directory)\/[^'"]+)['"]/.exec(row)?.[1], base),
      gender: null,
    };
  }).filter((c) => c.name);
}

/**
 * PrestoSports card grid: each card's link is labelled "Name, Title, Full
 * Bio" and the headshot is a CSS background. Email lives on the bio page.
 */
export function parsePrestoCards(html, base) {
  return [...html.matchAll(/<a[^>]*href="([^"]*\/coaches\/[^"]+)"[^>]*aria-label="([^"]+?),\s*Full Bio"/g)].map((m) => {
    const [name, ...rest] = decode(m[2]).split(/,\s*/);
    const before = html.slice(Math.max(0, m.index - 1500), m.index);
    const bg = [...before.matchAll(/background-image:url\('([^']+)'\)/g)].pop()?.[1];
    return {
      name,
      title: rest.join(", "),
      email: null,
      phone: null,
      photo: bg ? absolute(bg.replace(/\?.*$/, "?max_width=300&max_height=300&crop=1"), base) : null,
      bio: absolute(m[1], base),
      gender: null,
    };
  }).filter((c, i, all) => c.name && all.findIndex((o) => o.name === c.name) === i);
}

/** PrestoSports and other plain staff tables: rows with a mailto and a title. */
export function parseStaffTable(html, base) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => decode(c[1])).filter(Boolean);
    const title = cells.find((t) => /coach|director of golf/i.test(t) && t.length < 80);
    if (!title) return null;
    const name = cells.find((t) => t !== title && /^[A-Z][\w.'’-]+( [A-Z][\w.'’-]+)+$/.test(t));
    if (!name) return null;
    const img = /<img[^>]*src=['"]([^'"]+)['"]/.exec(row)?.[1];
    return {
      name,
      title,
      email: /mailto:([^'"?]+)/.exec(row)?.[1]?.trim() || null,
      phone: cells.find((t) => /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(t)) || null,
      photo: absolute(img, base),
      gender: null,
    };
  }).filter(Boolean);
}

const NOT_HEAD = /assistant|associate|volunteer|graduate|student|operations|trainer|strength|conditioning|athletic director|sports information|equipment/i;

/** "Head Coach", "Head Women's Golf Coach", "Director of Men's & Women's Golf". */
const IS_HEAD = /\bhead\b|director of\s+((men|women)[\x27’]?s\s+|and\s+|&\s+|harvard\s+)*golf\b/i;

/** Alumni class years some schools print after a name: "Brent Greenwood '14". */
export const cleanName = (n) => String(n || "").replace(/\s+['’]\d{2}$/, "").trim();

/**
 * The head coach for `team` from a page's staff list, or null.
 * A combined /sports/golf page names both teams' coaches; a title saying
 * the OTHER team rules a person out ("Head Women's Golf Coach" is not the
 * men's coach), and a title saying this team ranks first.
 */
export function pickHeadCoach(staff, team) {
  const mine = team === "men" ? /\bmen'?s\b|\bmen\b/i : /women'?s|\bwomen\b/i;
  const other = team === "men" ? /women'?s|\bwomen\b/i : /\bmen'?s\b|\bmen\b/i; // \b keeps "women" from matching "men"
  const genderCode = team === "men" ? "m" : "f";
  const heads = staff.filter((c) => {
    if (!c.name || !c.title) return false;
    // Judge each part of a combined title on its own: "Director of Golf
    // Operations / Head Men's Golf Coach" is a head coach, even though
    // "Operations" alone would rule a person out.
    const parts = c.title.split(/\s*[/|;]\s*|,\s+(?=head|director)/i);
    if (!parts.some((t) => IS_HEAD.test(t) && !NOT_HEAD.test(t))) return false;
    // A golf page's staff list can include shared staff; a "Head ... Coach"
    // title naming no sport is fine, one naming another sport is not.
    if (!/golf/i.test(c.title) && !/^(interim\s+)?head\s+coach$/i.test(c.title.trim())) return false;
    if (c.gender && c.gender !== genderCode) return false;
    if (other.test(c.title) && !mine.test(c.title)) return false;
    return true;
  });
  const score = (c) => (mine.test(c.title) ? 2 : 0) + (/head/i.test(c.title) ? 1 : 0);
  heads.sort((a, b) => score(b) - score(a));
  return heads[0] || null;
}

/** SIDEARM images go through SIDEARM's own resizer, as the hand-set rows do. */
export function sizedPhoto(url) {
  if (!url || !/^https:\/\//i.test(url)) return null;
  if (/images\.sidearmdev\.com\/resize/.test(url) || /[?&](max_)?width=\d+/.test(url)) return url;
  if (/\/images\/\d{4}\/\d{1,2}\/\d{1,2}\//.test(url)) {
    return `https://images.sidearmdev.com/resize?url=${encodeURIComponent(url)}&width=300&type=webp`;
  }
  return url;
}

const cleanEmail = (e) => (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null);
const cleanPhone = (p) => (p && /\d{3}.*\d{4}/.test(p) ? p.replace(/\s+/g, " ").trim() : null);

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function getPage(url) {
  const file = new URL(url.replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]+/gi, "_").slice(0, 180) + ".html", CACHE);
  if (!REFRESH && fs.existsSync(file)) {
    const cached = fs.readFileSync(file, "utf8");
    return cached.startsWith("ERR ") ? null : { html: cached, url };
  }
  let result = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (res.ok) result = { html: await res.text(), url: res.url || url };
  } catch { /* unreachable site: recorded as a miss */ }
  fs.writeFileSync(file, result ? result.html : `ERR ${url}`);
  return result;
}

/**
 * What a coach's own bio page adds when the staff list leaves it off: the
 * headshot (an <img> captioned with their name, on SIDEARM) and the email /
 * phone (PrestoSports lists those only on the bio page). Only mailto: and
 * tel: links are read, so a newsletter sign-up address is never mistaken
 * for the coach's.
 */
async function detailsFromBio(url, ...names) {
  const page = await getPage(url);
  if (!page) return {};
  const html = page.html;
  let photo = null;
  for (const m of html.matchAll(/<img[^>]*>/g)) {
    const tag = m[0];
    const alt = decode(/alt=["']([^"']*)["']/.exec(tag)?.[1]);
    const src = /src=["']([^"']+)["']/.exec(tag)?.[1];
    if (src && alt && names.some((n) => n && alt.toLowerCase().includes(n.toLowerCase())) && /\/(images|photos)\//.test(src)) {
      photo = sizedPhoto(absolute(src, page.url));
      break;
    }
  }
  const emails = [...html.matchAll(/mailto:([^'"?\s]+@[^'"?\s]+)/g)].map((m) => m[1]);
  const phone = /href=["']tel:([^"']+)["']/.exec(html)?.[1];
  // Several addresses on the page (footer, sports info) -> only trust one
  // that looks like the coach's own: it contains part of their surname.
  const last = (names[0] || "").split(/\s+/).pop()?.toLowerCase() || "";
  const email = emails.find((e) => last.length > 2 && e.toLowerCase().includes(last.slice(0, 4))) || null;
  return { photo, email, phone: email ? decode(phone) : null };
}

async function coachFor(site, team) {
  for (const p of PATHS[team]) {
    const page = await getPage(`https://${site}${p}`);
    if (!page) continue;
    const staff = [...parseNuxt(page.html, page.url), ...parseSidearmTable(page.html, page.url), ...parsePrestoCards(page.html, page.url)];
    const list = staff.length ? staff : parseStaffTable(page.html, page.url);
    const head = pickHeadCoach(list, team);
    if (head) {
      const name = cleanName(head.name);
      let email = cleanEmail(head.email);
      let phone = cleanPhone(head.phone);
      let photo = sizedPhoto(head.photo);
      if (head.bio && (!photo || !email)) {
        const more = await detailsFromBio(head.bio, head.name, name);
        photo ||= more.photo || null;
        if (!email) { email = cleanEmail(more.email); phone ||= cleanPhone(more.phone); }
      }
      return { name, title: head.title, email, phone, photo, source: page.url };
    }
  }
  return null;
}


async function pool(items, n, fn) {
  let i = 0;
  let done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  }));
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });

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
    const site = sites.get(p.ncaaId);
    for (const team of ["men", "women"]) if (p.programs?.[team]) jobs.push({ p, team, site });
  }
  console.log(`${jobs.length} teams at ${new Set(jobs.map((j) => j.site)).size} athletics sites`);

  const found = {};
  const missed = [];
  await pool(jobs, CONCURRENCY, async ({ p, team, site }) => {
    const coach = site ? await coachFor(site, team) : null;
    if (coach) (found[p.ncaaId] ??= {})[team] = coach;
    else missed.push(`${p.name} (${team}) ${site || "no athletics site listed"}`);
  });

  const today = new Date().toISOString().slice(0, 10);
  const teams = jobs.length - missed.length;
  const sorted = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a - b));
  fs.writeFileSync(OUT, `/**
 * data/coaches-ncaa.js — GENERATED by tools/gen-coaches.mjs on ${today}. Do not hand-edit.
 *
 * Head golf coaches read off each school's own athletics "Coaches" page
 * (source URL on every entry), keyed by NCAA org id, then team.
 * ${teams} of ${jobs.length} teams found. email / phone / photo are null where the
 * school does not publish one; nothing here is guessed. Hand-verified entries
 * in coaches.js take priority over these.
 */
export const COACHES_SCRAPED = "${today}";

export const NCAA_COACHES = ${JSON.stringify(sorted)};
`);
  fs.writeFileSync(new URL("./.cache/coaches-missed.txt", import.meta.url), missed.sort().join("\n") + "\n");
  console.log(`Found ${teams} of ${jobs.length} teams. Misses listed in tools/.cache/coaches-missed.txt`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
