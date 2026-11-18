/**
 * data/dripgolf.js — look a new golfer up in the Drip Golf Tour standings.
 *
 * The sign-up survey asks for a first and last name. As those are typed, this
 * module matches them against the players on the tour's public standings, and
 * picking a match fills in what Drip Golf already knows: hometown, class year,
 * scoring average, and (from the player's profile page) age and JGS rank.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A SERVER FUNCTION IN THE MIDDLE
 * ---------------------------------------------------------------------------
 * dripgolftour.com sends no CORS headers, so a browser on this origin cannot
 * read its pages. netlify/functions/drip-golf.mjs fetches them server-side and
 * hands back JSON from /api/drip-golf. The parsers live HERE rather than in the
 * function so the Node tests can exercise them on a fixture without a network.
 *
 * Parsing is regex over the tour's HTML, which is honest about being fragile:
 * if Drip Golf redesigns the standings table, the list comes back empty and the
 * survey simply works as it did before -- type the name, fill the fields. A
 * lookup that fails quietly costs a few keystrokes; one that throws costs a
 * sign-up.
 *
 * Past seasons are not fetched at all: they never change, so
 * tools/gen-dripgolf-history.mjs snapshots them into data/dripgolf-history.js
 * and loadRoster() merges that with the live current season.
 */

const TOUR_ORIGIN = "https://www.dripgolftour.com";

/**
 * The tour's site (redesigned Nov 2026) lists every division of a season on
 * one standings page; with no `season` it is the current season. A season is
 * named the way the site names it: "2025-26", "2023", "2021-2022".
 */
export const standingsUrl = (season = "") =>
  `${TOUR_ORIGIN}/standings${season ? `?season=${encodeURIComponent(season)}` : ""}`;

// One player's whole career: age and rankings, career scoring stats and every
// tournament they have played on the tour.
export const profileUrl = (playerId) =>
  `${TOUR_ORIGIN}/profile/${playerId}?season=all&division=all`;

export const PLAYER_ID = /^\d{1,9}$/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** The text inside the first element whose class list includes `cls`. */
const byClass = (html, cls) =>
  decode(String(html).match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([^<]*)<`))?.[1] ?? "");

const num = (s) => (s === "" || !Number.isFinite(Number(s)) ? undefined : Number(s));

/** "Jack Jack Freeman" -> ["Jack Jack", "Freeman"]; a suffix stays with the surname. */
export function splitName(full) {
  const parts = decode(full).split(" ").filter(Boolean);
  if (parts.length < 2) return [parts[0] || "", ""];
  let cut = parts.length - 1;
  if (cut > 1 && /^(jr|sr|i{2,3}|iv)\.?$/i.test(parts[cut])) cut -= 1;
  return [parts.slice(0, cut).join(" "), parts.slice(cut).join(" ")];
}

/** A standings page -> the players on it, every division on the page. */
export function parseStandings(page) {
  const players = [];
  for (const panel of String(page).split(/<div class="standings__division[\s"]/).slice(1)) {
    const division = byClass(panel, "standings__division-name");
    for (const row of panel.split(/<tr class="standings__row\b/).slice(1)) {
      const link = row.match(/href="\/profile\/(\d+)[^"]*"[^>]*>([^<]+)<\/a>/);
      if (!link) continue;
      const [firstName, lastName] = splitName(link[2]);
      const labeled = (label) => decode(row.match(new RegExp(`data-label="${label}"[^>]*>([^<]*)<`))?.[1] ?? "");
      players.push({
        id: link[1],
        name: decode(link[2]),
        firstName,
        lastName,
        division,
        rank: byClass(row, "standings__td--rank"),
        hometown: byClass(row, "standings__td--hometown"),
        classYear: byClass(row, "standings__td--grad"),
        points: num(labeled("Points")),
        scoringAvg: num(labeled("Scoring Average")),
        events: num(labeled("Events")),
      });
    }
  }
  return players;
}

/** A player profile page -> the extra facts the standings table leaves out. */
export function parseProfile(page) {
  const p = String(page);
  // "Gloucester, VA · Class of 2027 · Age 17"
  const bio = byClass(p, "player-profile__bio");
  // Each ranking sits beside its organisation's logo: "Overall Rank: <strong>9024</strong>"
  const rank = (org) => num(p.match(new RegExp(`alt="${org}"[\\s\\S]{0,400}?Overall Rank:\\s*<strong>(\\d+)<`))?.[1] ?? "");
  return {
    age: num(bio.match(/\bAge\s+(\d+)/)?.[1] ?? ""),
    jgsRank: rank("Junior Golf Scoreboard"),
    tugrRank: rank("The Universal Golf Rankings"),
  };
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/**
 * A player profile page -> every tournament on it, in the golfer page's own
 * tournament shape: { year, date: "10/17/2026", name, division, place,
 * total: "163 (+21)", points, rounds: [{ round, score: "84 (+13)", course }] }.
 */
export function parseTournaments(page) {
  const out = [];
  for (const card of String(page).split(/<div class="player-profile__tnmt-card"/).slice(1)) {
    const name = byClass(card, "player-profile__tnmt-name");
    const when = byClass(card, "player-profile__tnmt-date").match(/^([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/);
    if (!name || !when || !MONTHS[when[1]]) continue;
    const stat = (label) => decode(card.match(new RegExp(
      `tnmt-rlabel">${label}</span>\\s*<span class="player-profile__tnmt-rval">([^<]*)<`))?.[1] ?? "");
    const courses = [...card.matchAll(/class="player-profile__sc-course">([^<]*)</g)].map((m) => decode(m[1]));
    const rounds = [...card.matchAll(
      /tnmt-round-no">R?(\d+)<\/span>\s*<span class="player-profile__tnmt-round-score">(\d+)<\/span>\s*<span class="player-profile__tnmt-round-topar">([^<]*)</g,
    )].map((m, i) => ({ round: m[1], score: `${m[2]} (${decode(m[3])})`, course: courses[i] || "" }));
    out.push({
      year: when[3],
      date: `${MONTHS[when[1]]}/${Number(when[2])}/${when[3]}`,
      name,
      division: byClass(card, "player-profile__tnmt-div"),
      place: byClass(card, "player-profile__tnmt-place-text"),
      total: stat("Total"),
      points: stat("Points"),
      rounds,
    });
  }
  return out;
}

/**
 * A player profile page -> the tour events they are signed up for, soonest
 * first: [{ date: "2027-02-27", name, division }].
 */
export function parseUpcoming(page) {
  const out = [];
  for (const item of String(page).split(/<a class="player-profile__upcoming-item"/).slice(1)) {
    const name = byClass(item, "player-profile__upcoming-name");
    // "Feb 27, 2027 · High School Boys"
    const [when, division = ""] = byClass(item, "player-profile__upcoming-meta").split("·").map((s) => s.trim());
    const d = (when || "").match(/^([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/);
    if (!name || !d || !MONTHS[d[1]]) continue;
    const pad = (n) => String(n).padStart(2, "0");
    out.push({ date: `${d[3]}-${pad(MONTHS[d[1]])}-${pad(d[2])}`, name, division });
  }
  return out;
}

/** The page's own labels for the Golf Bio scoring stats, in display order. */
export const SCORING_PAR_FIELDS = Object.freeze(["Par 3's", "Par 4's", "Par 5's"]);
export const SCORING_TYPE_FIELDS = Object.freeze(["Eagles", "Birdies", "Pars", "Bogeys", "Doubles", "Others"]);

/**
 * A player profile page -> its "Scoring Profile" and "Scoring Types" boxes,
 * e.g. { "Par 3's": "3.28", Birdies: "20 (13.89%)" }. These come from Drip
 * Golf official tournaments only. Anything missing is left out, so a redesign
 * of the profile page gives {} rather than wrong numbers.
 */
export function parseScoring(page) {
  const p = String(page);
  const out = {};
  for (const field of SCORING_PAR_FIELDS) {
    // <span ...tile-value">3.50</span> <span ...tile-label">Par 3 Avg</span>
    const label = `${field.replace("'s", "")} Avg`;
    const m = p.match(new RegExp(
      `tile-value">(\\d+(?:\\.\\d+)?)</span>\\s*<span class="player-profile__tile-label">${label}<`));
    if (m) out[field] = m[1];
  }
  for (const field of SCORING_TYPE_FIELDS) {
    // <span ...type-label">Pars</span> <span ...type-count">30 <span ...type-pct">(41.7%)</span>
    const m = p.match(new RegExp(
      `type-label">${field}</span>\\s*<span class="player-profile__type-count">(\\d+)\\s*(?:<span class="player-profile__type-pct">\\(([\\d.]+%)\\))?`));
    if (m) out[field] = m[2] ? `${m[1]} (${m[2]})` : m[1];
  }
  return out;
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Players whose names start with what has been typed so far. Either box may be
 * empty; with both empty there is nothing to suggest.
 */
export function matchPlayers(players, first, last, limit = 6) {
  const f = fold(first);
  const l = fold(last);
  if (!f && !l) return [];
  return players
    .filter((p) => (!f || fold(p.firstName).startsWith(f)) && (!l || fold(p.lastName).startsWith(l)))
    .slice(0, limit);
}

/**
 * One row per golfer: everyone this season, then anyone from a past season not
 * already listed. A golfer who still plays keeps this season's row -- their
 * hometown and scoring average from now, not from 2021.
 */
export function mergeRosters(current, past) {
  const seen = new Set(current.map((p) => p.id));
  return [...current, ...past.filter((p) => !seen.has(p.id))];
}

/** A girls' division ("Female Elite"); every other division on the tour is boys'. */
export const isGirlsDivision = (division) => /female|girls|women/i.test(division || "");

/**
 * Lazy, once per page load: this season (live, via /api/drip-golf) plus every
 * past season (the generated snapshot). Either half can fail on its own --
 * under `python serve.py` there is no /api, and past seasons still match.
 * The snapshot is a dynamic import so the landing page never downloads it.
 */
let roster;
export function loadRoster() {
  roster ??= Promise.all([
    fetch("/api/drip-golf")
      .then((r) => (r.ok ? r.json() : { players: [] }))
      .then((d) => (Array.isArray(d.players) ? d.players : []))
      .catch(() => []),
    import("./dripgolf-history.js")
      .then((m) => m.DRIP_HISTORY)
      .catch(() => []),
  ]).then(([current, past]) => mergeRosters(current, past));
  return roster;
}

/** Age and JGS rank for one player, or {} if the profile could not be read. */
export function loadProfile(id) {
  if (!PLAYER_ID.test(String(id))) return Promise.resolve({});
  return fetch(`/api/drip-golf?player=${id}`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
}
